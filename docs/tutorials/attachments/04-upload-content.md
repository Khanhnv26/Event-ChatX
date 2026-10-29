# Nhận nội dung file qua HTTP

## Phạm vi đã hoàn thành

- `POST /api/v1/rooms/{slug}/attachments`: tạo intent và giữ quota.
- `PUT /api/v1/rooms/{slug}/attachments/{publicId}/content`: nhận raw binary qua `application/octet-stream`, không dùng multipart hay base64.
- Chỉ uploader có session còn hiệu lực trong đúng phòng được gửi file. Kiểm tra phòng, session và thời hạn ở cả trước và sau khi stream.
- Trạng thái: `RESERVED -> UPLOADING -> PROCESSING`. Chưa có worker scan/chuẩn hóa ảnh nên không tự chuyển READY hoặc cho gửi file trong chat.

## Cách hoạt động

AttachmentContentServiceImpl dùng các transaction SQL ngắn để claim và hoàn tất. Không giữ khóa SQL trong lúc đọc dữ liệu mạng. Claim lấy khóa Room rồi Attachment, giới hạn hai upload đồng thời mỗi phiên. Semaphore giới hạn mặc định tám upload mỗi backend; đây là giới hạn cho một instance dùng local storage.

Storage key UUID được ghi vào SQL trước khi stream. Storage dùng cùng key cho file hoàn chỉnh và `.upload-{key}.part`, giúp tìm được dữ liệu cần dọn sau khi tiến trình dừng. Không dùng tên file gốc làm đường dẫn. Storage từ chối ghi quá kích thước intent dù request không có Content-Length. Service kiểm tra cả trường hợp đọc thiếu byte. File cùng key không được ghi đè.

Nếu upload thất bại, service ghi deletion task trước khi xóa object/partial file. Xóa thành công thì reset về RESERVED để có thể thử lại trong hạn cũ, không giữ thêm quota. Xóa thất bại thì giữ storage key, UPLOADING và deletion task; không cho upload khác ghi đè hoặc giải phóng quota khi dữ liệu có thể còn tồn tại. Nếu database cũng lỗi, ledger của claim vẫn giữ key; cleanup job sẽ cần phục hồi upload hết hạn.

PROCESSING giữ nguyên reserved bytes, actual_size_bytes và SHA-256 được ghi sau khi nhận đủ byte. Chỉ bước xử lý sau này mới chốt charged bytes và giải phóng phần reservation dư.

## Thử thủ công trong Postman

1. Dùng một room đang ACTIVE và session token của uploader trong phòng đó.
2. POST intent với filename, declaredContentType, clientUploadId UUID viết thường và sizeBytes đúng bằng kích thước file. Lưu data.publicId.
3. PUT URL content, header X-Session-Token như bước trước; Body -> binary -> chọn đúng file. Header Content-Type là application/octet-stream.
4. Kỳ vọng HTTP 200, data.state PROCESSING và sizeBytes bằng size file.
5. Gửi lại PUT cùng ID: HTTP 409, không ghi đè file đã nhận.

MIME trên PUT là kiểu truyền byte. MIME của file được khai báo trong POST và sẽ phải được xác minh từ nội dung ở bước xử lý; không được coi MIME khai báo là bằng chứng file an toàn.

## Cấu hình

- `app.rate-limit.upload-content.capacity=4`, `refill-per-second=0.1`: bucket riêng cho PUT, cùng các bucket IP/room hiện có.
- `app.upload.attachments.max-concurrent-uploads=8`: trần đồng thời trên một backend.
- `app.upload.storage.min-free-bytes=67108864`: từ chối bắt đầu ghi nếu không đủ chỗ cho file và phần dung lượng dự phòng 64 MiB. Đây là kiểm tra trước upload, không phải reservation dung lượng ổ đĩa nguyên tử giữa các tiến trình.
- Nginx chỉ nâng body limit lên 20 MiB ở đường dẫn attachment content, giữ 64 KiB cho JSON/chat và tắt request buffering cho stream.
- Production compose mount volume upload_data vào /app/artifacts/uploads. Dockerfile tạo thư mục với quyền cho user eventchat. Không triển khai nhiều backend với các ổ local độc lập.

## Còn phải làm trước khi hoàn thiện tính năng attachment

1. Worker kiểm tra MIME/signature, scan virus, giới hạn tài nguyên giải mã ảnh, chuẩn hóa ảnh và thumbnail; PROCESSING -> READY/REJECTED.
2. Cleanup/reconciliation upload dở và deletion tasks, cập nhật quota; tích hợp retention phòng trước khi bật production. Ledger FK hiện ngăn purge phòng còn attachment, cần enqueue dọn file rồi xử lý metadata đúng thứ tự.
3. API metadata/status, hủy attachment, download/thumbnail có quyền truy cập.
4. Liên kết attachment vào tin nhắn và frontend upload queue.

Không có migration mới trong bước này; dùng schema V7 hiện có.

## Kết quả kiểm tra ngày 2026-10-29

- Toàn bộ backend: 336 test, không failure/error, 7 test bị skip theo điều kiện môi trường.
- Sau khi bổ sung các case storage và mất quyền giữa lúc stream: chạy lại 23 test upload/storage, tất cả pass. Test dùng H2 và filesystem thật trong thư mục tạm; chưa xác minh concurrency bằng MySQL thực hoặc HTTP qua toàn bộ stack.
- `nginx -t` chạy thành công bằng nginx:alpine trong container tạm không mạng.
- `docker compose -f compose.production.yaml config --quiet` hợp lệ với giá trị môi trường giả dành cho kiểm tra. Chưa build/redeploy production.
- OpenAPI JSON đọc được và mọi local $ref đều resolve.
