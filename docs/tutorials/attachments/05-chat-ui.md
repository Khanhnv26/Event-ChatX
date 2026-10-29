# Upload ảnh và tài liệu trong chat

## Luồng người dùng

Nút kẹp giấy nằm cạnh ô chat. Có thể chọn nhiều file, kéo thả vào composer hoặc dán ảnh từ clipboard. Tối đa bốn file mỗi tin nhắn, ảnh JPEG/PNG 5 MiB, tài liệu 20 MiB. Hỗ trợ PDF, DOCX, XLSX, PPTX và văn bản UTF-8 TXT/CSV.

Draft hiển thị tên, dung lượng, preview, tiến trình, lỗi, nút bỏ/thử lại. Chỉ gửi khi mọi file còn được chọn đã READY; có thể gửi tệp không kèm chữ. Gửi lỗi giữ lại text/reply/file và dùng lại clientMessageId cho cùng payload để tránh gửi trùng khi mất phản hồi. Chuyển phòng hoặc rời composer hủy request và thu hồi object URL. Thành viên bị thu hồi phiên không được tải thêm nội dung.

## Cấu trúc code

- attachmentApi: intent, PUT binary với progress/abort, status, cancel và protected blob download.
- AttachmentUploadQueue: sở hữu request, giới hạn hai công việc đồng thời, retry và object URL; hook useAttachmentUploads đăng ký snapshot bằng useSyncExternalStore. Progress không được đưa lên state của lịch sử chat.
- AttachmentDraftList, MessageAttachments, ImagePreviewModal: component riêng, dùng semantic tokens của workspace và ModalPortal/MotionPresence. Ảnh giữ aspect ratio, thumbnail chỉ tải khi gần viewport. Có reduced motion, dark mode, focus trap và Escape trong modal.
- Backend tách access, processing, validation, linking và cleanup theo nhiệm vụ. DTO metadata đặt trong dto/response, kết quả chuẩn hóa và AttachmentDownload trong model. Service chọn nội dung/thumbnail, MIME và mở storage; controller chỉ mapping hai route download và tạo HTTP headers/resource. Không dùng var trong code Java mới.

## Chạy local

```powershell
docker compose up -d clamav
```

Khởi động backend và frontend như bình thường. ClamAV mặc định localhost:3310; lần đầu cần đợi health healthy và dữ liệu chữ ký sẵn sàng. Không có tùy chọn bỏ qua scan để cho READY. Production compose dùng host clamav trong mạng riêng, không publish cổng scanner. Cấu hình app.upload.scanner.host/port/timeout-millis và max-image-pixels nếu cần. Chỉ deploy một backend khi storage là ổ local.

Scanner dùng giao thức [ClamAV INSTREAM](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), stream có giới hạn và chỉ chấp nhận verdict sạch rõ ràng. Scanner hoặc storage không sẵn sàng giữ PROCESSING để retry, không công bố file. ImageIO kiểm tra format và giới hạn 16 triệu pixel trước giải mã, ghi lại ảnh không metadata và tạo thumbnail JPEG. OOXML kiểm tra container, main part, content types, cấm macro và giới hạn 1.000 entry/64 MiB giải nén. Văn bản phải là UTF-8 không chứa control byte bất thường; PDF kiểm tra header/footer và được ép download. Antivirus và kiểm tra định dạng không phải bảo đảm mọi tài liệu đều vô hại.

## Nhất quán và dọn dữ liệu

Chat lấy khóa Room rồi bind attachment của chính uploader trong SQL transaction. Mongo lưu snapshot attachment. History chỉ hiển thị tin có SQL binding LINKED đúng clientMessageId; broadcast sau SQL commit. Nếu Mongo đã lưu nhưng SQL chưa commit, reconciler thử hoàn tất binding với session/phòng còn hợp lệ. Retry cùng client ID và payload phục hồi binding; đổi payload bị từ chối. Reconciler có thể phát lại cùng message ID, client merge theo ID.

File READY chưa gửi giữ tối đa 24 giờ, file đã gửi giữ đến room.expiresAt + 7 ngày. Cleanup ghi deletion task bền vững, xóa object/partial file rồi mới trả quota. Purge phòng chuyển các key sang outbox trước khi xóa attachment/room; công việc xóa tồn tại độc lập với FK phòng. Nếu cancel trong lúc stream/xử lý, lượt hoàn tất không được làm file sống lại và phải đưa key vừa ghi vào hàng đợi xóa lại. Thư mục upload nằm trên volume, không có đường dẫn Nginx public tới file.

Không cần migration mới; dùng schema V7 hiện có. Không tự khởi động lại backend/database production.

## Kiểm thử

- Bộ backend đã chạy 357 test: 0 lỗi, 7 skip theo môi trường, gồm purge giữ deletion outbox và download controller/service sau refactor.
- Frontend: 147 test pass (138 test hiện có và 9 test queue/composer mới); build TypeScript/Vite thành công. Lint không thêm warning ở code upload; dự án còn warning cũ trong các component khác.
- scripts/acceptance/attachments.mjs chỉ chạy trên stack test riêng localhost:18082: MySQL/Mongo/Redis/RabbitMQ và ClamAV thật. Đã qua ảnh chuẩn hóa/thumbnail, tin chỉ có file, idempotency, draft riêng tư, download được bảo vệ, file giả ảnh, mẫu EICAR vô hại và cancel.
- File test, ảnh chụp, log và cấu hình stack riêng nằm trong artifacts/ và không đưa lên Git.
- Kiểm tra trình duyệt thực: ảnh/file xuất hiện trong lịch sử chat; viewport 390 x 844 có scrollWidth bằng 390, không tràn ngang. Modal ảnh nhận focus, đóng bằng Escape và trả focus về nút xem ảnh. Đã khôi phục viewport sau kiểm tra.
