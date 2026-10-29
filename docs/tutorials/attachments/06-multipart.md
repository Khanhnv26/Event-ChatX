# Attachment multipart cho bản portfolio

## API hiện tại

`POST /api/v1/rooms/{slug}/attachments` nhận multipart/form-data, field `file`, header X-Session-Token. Trả AttachmentResponse ở trạng thái READY; không tạo intent hay PUT content. Upload lại sau khi mất response có thể tạo file khác; draft không gửi sẽ tự hết hạn trong tối đa 24 giờ.

Hỗ trợ JPEG/PNG tối đa 5 MiB; PDF/DOCX/XLSX/PPTX/TXT/CSV tối đa 20 MiB; quota mỗi phòng mặc định 200 MiB. Content-Type phía browser không được dùng để chọn giới hạn ảnh hoặc quyền inline. Service dùng allowlist theo extension, kiểm tra signature JPEG/PNG và lưu bằng UUID. Tài liệu luôn tải xuống bằng Content-Disposition attachment. Bản đơn giản này không quét virus, giải mã/chuẩn hóa ảnh hoặc kiểm tra sâu nội dung tài liệu; không mô tả tính năng đó trong CV.

Spring cấu hình max-file-size=20MB, max-request-size=21MB. Nginx chỉ nâng body limit lên 21 MiB cho endpoint multipart, giữ 64 KiB cho JSON/chat; phần dư dành cho multipart headers/boundaries.

`GET /attachments/{id}/content` và `/thumbnail` kiểm tra session SQL còn hiệu lực, đúng phòng, state và expiresAt. Chỉ uploader xem được draft chưa gửi. File LINKED được thành viên còn quyền tải trong retention. Thumbnail dùng ảnh cũ đã có thumbnail hoặc fallback ảnh gốc; tài liệu không có preview ảnh. Không đặt token vào URL.

`DELETE /attachments/{id}` chỉ uploader được gọi cho file chưa LINKING/LINKED. Thao tác đánh dấu DELETING và ghi công việc xóa; cleanup xóa byte xong mới xóa metadata và trả quota. Lỗi storage được retry, không mất storage key.

## Code dễ theo dõi

- AttachmentController: mapping HTTP, headers và response.
- AttachmentService/AttachmentServiceImpl: upload, quyền đọc/xóa, filename/type/size, room lock và TTL.
- AttachmentLifecycleService: quota và deletion task dùng chung với cleanup. Có sửa counters cho dữ liệu multipart cũ chưa được tính quota.
- StorageService: byte stream/private path, kiểm tra dung lượng và SHA-256.
- AttachmentUploadQueue: tối đa hai upload đồng thời, progress, abort/retry và quản lý object URL. React đọc snapshot qua useAttachmentUploads; không có trạng thái processing/clientUploadId giả.

Multipart đã được servlet nhận trước khi service chạy, nên transaction khóa Room chỉ bao phủ sao chép file local và lưu metadata; không giữ row lock trong lúc browser truyền toàn bộ file. Upload và delete khóa Room trước, delete tiếp tục khóa Attachment để không xóa nhầm file vừa được gửi. Không dùng var hay model lồng trong service.

## SQL và filesystem

Ghi file không thuộc transaction SQL. Upload đăng ký cleanup khi transaction rollback, gồm cả lỗi lúc commit. Nếu không xóa được file ngay, một transaction độc lập ghi deletion task để thử lại. Khi cả database và storage cùng lỗi, hệ thống ghi log để vận hành xử lý; không tuyên bố có distributed transaction.

Draft chưa gửi hết hạn sau tối đa 24 giờ. Khi gửi, AttachmentLinkService gắn vào clientMessageId và đặt retention đến room.expiresAt + 7 ngày. AttachmentMessageRecovery là job nhỏ phục hồi Mongo đã lưu nhưng SQL binding rollback; chỉ phục hồi nếu session/phòng/file vẫn hợp lệ, broadcast sau SQL commit. Nó không phải worker xử lý file/antivirus.

Không cần migration mới và không tự sửa dữ liệu hoặc restart database hiện tại. Quota legacy được đối chiếu trong transaction có Room lock khi upload hoặc cleanup.

## Kiểm thử

MultipartAttachmentServiceTest dùng H2 và storage thật ở thư mục tạm: quyền draft, hết hạn, quota, ghi SQL/commit thất bại, retry xóa file, stream đóng đúng và race gửi/xóa. AttachmentMessageRecoveryTest kiểm tra phục hồi, rollback, session bị thu hồi và phòng đã đóng.

scripts/acceptance/attachments.mjs chỉ dùng stack test riêng localhost:18082: upload multipart hơn 1 MiB qua Nginx/Spring, trả 413 khi quá giới hạn, bảo vệ draft, tin chỉ có file, retry tin nhắn, download và cancel. Không chạy script trên database production.

Các chương intent/raw upload trước đây là lịch sử thiết kế; chương này và OpenAPI mô tả phiên bản multipart hiện tại.
