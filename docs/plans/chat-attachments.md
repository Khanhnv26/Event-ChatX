# Kế hoạch upload ảnh và file trong EventChat

Ngày: 2026-10-28. Trạng thái: đề xuất, chưa triển khai hoặc migrate.

## 1. Phương án đề xuất

Thêm tệp đính kèm cho tin nhắn bằng module attachment riêng. Frontend tải từng tệp qua HTTP, sau đó gửi tin nhắn JSON chứa attachmentIds. WebSocket chỉ phát thông tin tin nhắn, không truyền byte hoặc base64 của tệp.

Giai đoạn đầu dùng ổ đĩa/VPS với Docker volume riêng, ngoài webroot. Đây là phương án không thêm hóa đơn dịch vụ lưu trữ; vẫn sử dụng tài nguyên, băng thông và dung lượng của máy chủ. Local storage chỉ phù hợp một backend hoặc các backend dùng chung storage đã được thiết kế riêng.

StorageService che giấu thao tác put/open/delete. LocalStorageService là adapter đầu tiên; có thể bổ sung adapter R2/S3 về sau. Không để controller hoặc frontend biết đường dẫn vật lý. Chưa cần đưa SDK S3 vào bản local.

Các giới hạn dưới đây là mặc định đề xuất, cấu hình được; chưa phải yêu cầu đã được người dùng xác nhận.

## 2. Phạm vi phiên bản đầu

- Tối đa 4 tệp tổng cộng trong một tin nhắn, có thể trộn ảnh và tài liệu.
- Ảnh JPEG/PNG: tối đa 5 MiB/tệp; tối đa 20 triệu pixel trước khi giải mã đầy đủ.
- Tài liệu PDF, DOCX, XLSX, PPTX, TXT, CSV: tối đa 20 MiB/tệp.
- Không mở rộng allowlist sang file thực thi, script, HTML, SVG, archive ZIP/RAR, Office có macro hoặc tài liệu mã hóa không thể kiểm tra.
- WEBP/GIF/HEIC, audio/video và resumable/chunk upload nằm ngoài bản đầu; bổ sung sau khi có decoder và kiểm thử tương ứng.
- Gửi chỉ ảnh/file hoặc kèm chú thích tối đa 2.048 ký tự. Nội dung phải có ít nhất văn bản hoặc một tệp hợp lệ.
- Chọn tệp từ máy; chọn/dán ảnh từ clipboard; kéo thả trên desktop.
- Ảnh hiển thị thumbnail trong chat, bấm để mở modal ảnh lớn. Tài liệu hiển thị thẻ tên, loại, dung lượng và nút tải xuống; chưa nhúng PDF/Office vào trình duyệt.
- Chỉ upload/gửi mới khi phòng còn ACTIVE và chưa hết hạn. Phòng đóng vẫn đọc/tải được theo quyền hiện có và chính sách lưu giữ.
- Chưa làm avatar, ảnh bìa phòng, chỉnh sửa ảnh hoặc xuất ZIP toàn bộ tệp.

## 3. Công nghệ và vị trí mã nguồn

- Backend: Spring Boot hiện có, MySQL lưu attachment/upload intent/quota/công việc dọn file; MongoDB giữ tin nhắn và snapshot metadata hiển thị.
- Ảnh: Java ImageIO kiểm tra khả năng giải mã và kích thước; Thumbnailator tạo thumbnail/ảnh hiển thị, xử lý hướng ảnh và tạo đầu ra không chứa metadata vị trí. Kiểm thử riêng độ trong suốt và hướng ảnh chụp điện thoại.
- Nhận dạng loại: Apache Tika với tập detector cần thiết; không tự thêm toàn bộ bộ trích xuất tài liệu. OOXML cần kiểm tra cấu trúc container có giới hạn, không chỉ nhìn magic ZIP hoặc tên mở rộng.
- Quét tệp: ClamAV trong mạng Docker nội bộ, có health check và cập nhật cơ sở dữ liệu. Bản production không đưa tài liệu chưa kiểm tra sang READY khi scanner lỗi hoặc quá hạn cập nhật.
- Frontend: React/TypeScript hiện tại; XMLHttpRequest cho tiến trình truyền byte và abort, dùng chung chính sách header/token/error với API client.
- UI ảnh lớn dùng ModalPortal/MotionPresence vừa chuẩn hóa, không thêm một bộ modal khác.
- Backend theo cấu trúc hiện có: modules/attachment/{controller,dto,entity,enums,repository,service,service/impl}; phần lưu byte đặt tại infrastructure/storage.
- Frontend: API attachment trong services, hook điều phối hàng đợi upload, component attachment picker/preview/file card/image viewer. Không nhồi toàn bộ logic vào ChatInputBar hoặc useEventChat.

## 4. Luồng upload và trạng thái

1. Người dùng chọn tệp, frontend kiểm tra sơ bộ số lượng/dung lượng/loại, hiện bản xem trước cục bộ.
2. Gọi API tạo upload intent với clientUploadId, tên hiển thị, dung lượng và loại khai báo. Backend kiểm tra session, phòng, rate limit và giữ chỗ quota nguyên tử.
3. Truyền nội dung từng tệp vào intent bằng HTTP PUT raw binary. Chọn raw body để có thể kiểm tra header/quyền/intent trước khi đọc stream, không cần parse một multipart lớn. Không giữ transaction/khóa phòng trong suốt quá trình truyền byte.
4. Stream có giới hạn vào file tạm; tính checksum; kiểm tra loại thực, cấu trúc, kích thước và scanner. Với ảnh, tạo các biến thể đã chuẩn hóa và thumbnail trong worker có giới hạn tài nguyên.
5. Kiểm tra lại trạng thái phòng và quyền session sau xử lý, trước khi chuyển sang READY. Nếu phòng đóng hoặc session bị thu hồi giữa chừng, không cho gắn tệp vào tin nhắn mới.
6. Chỉ khi mọi tệp được chọn đã READY mới cho gửi tin nhắn với attachmentIds. Người dùng có thể bỏ tệp lỗi rồi gửi phần còn lại.
7. Backend xác nhận các ID cùng phòng, thuộc uploader hiện tại, chưa hết hạn và chưa gắn vào tin khác; snapshot metadata do server lấy, không nhận URL/tên/kích thước đáng tin từ client.
8. Retry gửi dùng lại clientMessageId và attachmentIds, không tạo tệp hoặc tin nhắn trùng.

Trạng thái dự kiến: RESERVED → UPLOADING → PROCESSING → READY → LINKING → LINKED. Các nhánh lỗi dùng REJECTED/EXPIRED; xóa qua DELETING. Mỗi bước phải idempotent hoặc có cách phục hồi rõ ràng.

Tiến trình UI phân biệt đang truyền byte, đang kiểm tra, sẵn sàng, đang gửi tin và lỗi. 100% truyền byte chưa đồng nghĩa tệp đã sẵn sàng. File đang PROCESSING được hỏi trạng thái với backoff có giới hạn, dừng khi đổi phòng/thu hồi phiên/hủy thao tác.

## 5. Hợp đồng API dự kiến

Các đường dẫn nằm dưới /api/v1/rooms/{slug}, dùng session header hiện có; không đặt token vào URL.

- POST /attachments: tạo intent và giữ quota; nhận clientUploadId, filename, sizeBytes, declaredContentType. Trả ID ngẫu nhiên, hạn intent và trạng thái.
- PUT /attachments/{id}/content: raw binary; giới hạn byte đọc thực tế, không chỉ tin Content-Length. Tệp READY/LINKED không được ghi đè bằng lượt PUT sau.
- GET /attachments/{id}: trạng thái/metadata. Chỉ uploader đọc được tệp chưa gắn vào tin nhắn; thành viên khác chỉ đọc metadata sau khi tệp đã được gửi.
- DELETE /attachments/{id}: hủy tệp chưa gắn của chính uploader và tạo công việc dọn dữ liệu. Không dùng API này để xóa tệp của tin nhắn đã gửi.
- GET /attachments/{id}/thumbnail: trả ảnh thu nhỏ đã xử lý, có kiểm tra quyền.
- GET /attachments/{id}/content: tải nội dung đã được phép; ảnh là biến thể hiển thị đã chuẩn hóa, tài liệu được ép tải xuống.
- POST /messages hiện có: bổ sung attachmentIds; sửa validation để chấp nhận tin nhắn chỉ có tệp.

Mã lỗi cần thống nhất theo convention dự án: 401/403 khi không có quyền, 409 khi trạng thái phòng/tệp không phù hợp, 413 khi quá kích thước, 415 khi loại không hỗ trợ, 429 kèm Retry-After khi quá giới hạn, 503 khi storage/scanner không sẵn sàng. Chi tiết mã quota sẽ được chốt trong API contract, không dùng một lỗi chung cho tất cả trường hợp.

## 6. Quyền truy cập và kiểm tra tệp

- Mọi endpoint kiểm tra cả slug và attachmentId, không chỉ biết ID là tải được.
- Tệp chưa gửi chỉ uploader truy cập được. Tệp đã gửi yêu cầu phiên còn quyền trong đúng phòng.
- Phiên bị kick mất quyền cho các yêu cầu tải tiếp theo. Không thể thu hồi bản sao người dùng đã tải trước đó.
- Tên lưu ngẫu nhiên do server tạo; tên gốc chỉ là metadata đã lọc. Kiểm tra đường dẫn resolve luôn nằm trong storage root, không dùng tên gốc để dựng path và không theo symlink ra ngoài thư mục.
- Kiểm tra đồng thời allowlist, MIME thực, signature/cấu trúc và giới hạn tài nguyên. Đổi đuôi tệp không làm tệp trở nên hợp lệ.
- Tệp tạm và quarantine nằm ngoài webroot, không được Nginx public serve. Không giải nén tùy ý hoặc chạy nội dung upload.
- Tài liệu: Content-Disposition: attachment, tên tải xuống được encode đúng; X-Content-Type-Options: nosniff. Không inline tài liệu chứa nội dung chủ động.
- Trả Cache-Control: private, no-store cho nội dung riêng tư; không ghi token, URL có thông tin xác thực hoặc byte tệp vào log.
- Ảnh chuẩn hóa không giữ metadata EXIF vị trí. Mặc định không lưu nguyên bản ảnh để giảm dung lượng và tránh đường tải làm lộ metadata; tài liệu giữ nội dung đã kiểm tra.
- Giới hạn memory, số pixel, thời gian decode/scan, số worker, số mục và tổng kích thước kiểm tra trong container OOXML. Scanner báo giới hạn/timeout không được coi là sạch.

Các nguyên tắc kiểm tra loại tệp, giới hạn kích thước, đổi tên và lưu ngoài webroot dựa trên OWASP File Upload Cheat Sheet; các con số quota là đề xuất riêng cho EventChat.

## 7. Quota và giới hạn vận hành

- Đề xuất 200 MiB/phòng, tính cả file tạm, phần đã giữ chỗ và các biến thể lưu thực tế; tránh trả quota quá sớm trước khi dữ liệu được xóa.
- Intent hết hạn sau 15 phút nếu không hoàn tất; tệp READY chưa gửi được dọn sau 24 giờ hoặc sớm hơn nếu hết hạn theo chính sách phòng.
- Token bucket upload riêng: burst 4 intent/session, hồi 1 token/10 giây. Bổ sung trần theo IP và phòng, cấu hình được; không để upload rơi vào TOOL_CREATE mặc định hiện tại.
- Tối đa 2 upload đồng thời trên một session; giới hạn worker xử lý và tổng upload đồng thời trên backend theo RAM/CPU VPS. Frontend gửi qua hàng đợi, không mở 4 request nặng cùng lúc.
- Retry cùng clientUploadId trả intent hiện có với cùng payload; payload khác phải bị từ chối. Không giữ quota hai lần cho cùng một thao tác.
- Có quota tổng storage và mức dung lượng trống tối thiểu, cấu hình theo ổ đĩa thực tế. Kiểm tra trước khi nhận upload; không đợi ổ đầy mới báo lỗi.
- Nginx hiện giới hạn 64KB. Chỉ nâng giới hạn ở endpoint truyền nội dung lên đủ 20 MiB cộng phần dự phòng, giữ giới hạn nhỏ cho JSON/chat. Cấu hình timeout và buffering phù hợp với streaming.
- Không tăng giới hạn frame STOMP để chứa ảnh/file; tin nhắn chỉ mang metadata và ID.

## 8. Dữ liệu và nhất quán

Migration SQL kế tiếp thêm metadata attachment, upload intent/reservation và công việc xóa bền vững. Tối thiểu cần roomId, uploaderSessionId, clientUploadId, displayName, detectedType, sizeBytes, checksum, object keys nội bộ, width/height khi có, state, expiry, clientMessageId đã gắn và lỗi xử lý.

Mongo Message bổ sung attachments[] với snapshot ID/tên/loại/kích thước/kích thước ảnh do server tạo. Tin nhắn cũ thiếu trường này được hiểu là danh sách rỗng. Có thể giữ MessageType.TEXT cho tin nhắn người dùng có cả text và attachment thay vì sinh nhiều loại cho mọi tổ hợp.

Không giả định transaction SQL bao phủ MongoDB hoặc filesystem. Trước khi làm UI cần chốt và kiểm thử giao thức LINKING/LINKED với clientMessageId, payload hash và cơ chế retry/reconciliation. Lỗi giữa ghi Mongo, gắn SQL và commit phải phục hồi được; tin nhắn chưa hoàn tất liên kết không được phát như một tin thành công. Snapshot trong tin nhắn không thay thế kiểm tra quyền của endpoint tải.

Không xóa attachment ledger hoặc khóa storage trước khi có công việc dọn bền vững. File đã gắn không được bị job dọn orphan nhặt nhầm khi một bước gửi tin đang retry.

## 9. Dọn file, backup và triển khai

- Dữ liệu đã gửi hết quyền truy cập khi đạt mốc room.expiresAt + 7 ngày; việc xóa vật lý chạy nền, có độ trễ và retry.
- Job riêng dọn intent quá hạn, upload dở, READY chưa gửi, file hết retention và các biến thể thumbnail. Quét theo batch, có lease nếu chạy nhiều worker, không chỉ phụ thuộc job xóa 25 phòng/giờ hiện tại.
- Khi purge phòng, đưa các object keys vào deletion outbox độc lập trước/cùng transaction xóa metadata SQL. Outbox không bị mất do cascade xóa phòng. Không trông chờ Mongo TTL tự xóa file trên ổ đĩa.
- Xóa physical object idempotent; không tìm thấy được coi là đã xóa. Storage lỗi thì giữ công việc và retry, không âm thầm bỏ qua.
- Docker volume upload phải sống qua rebuild/restart; không lưu vào filesystem tạm của container.
- Backup/restore bao gồm volume và metadata liên quan. Lịch giữ backup là chính sách riêng; không tuyên bố dữ liệu biến mất khỏi mọi bản backup ngay tại thời điểm hết retention.
- Theo dõi dung lượng, reservation quá hạn, hàng đợi scan/xóa, upload lỗi và độ trễ; không đưa nội dung tệp vào metrics/log.
- Trước khi scale backend sang nhiều instance, chuyển sang shared object storage như R2/S3 hoặc thiết kế shared volume phù hợp; ổ local riêng từng container không đáp ứng được.

## 10. Frontend và hiệu năng

- Thêm nút đính kèm cạnh emoji. Bản xem trước có tên/kích thước, xóa, hủy, retry và tiến trình từng tệp.
- Không làm mất nội dung nhập và tệp READY khi gửi tin thất bại. Khi đổi phòng, hủy request và ngăn response cũ sửa state phòng mới.
- API dùng header session hiện có. Thẻ img không tự gắn custom header: thumbnail/ảnh riêng tư phải fetch có xác thực rồi hiển thị qua object URL.
- Chỉ fetch thumbnail khi gần vùng nhìn bằng IntersectionObserver; loading="lazy" đơn thuần không trì hoãn một fetch Blob đã chạy trước đó.
- Lưu width/height/aspect ratio để chat không nhảy vị trí khi ảnh tải xong. Chỉ tải ảnh lớn khi mở modal.
- Cache thumbnail trong bộ nhớ có giới hạn; revoke object URLs khi bị loại khỏi cache, bỏ tệp, đổi phòng hoặc unmount. Không nhét Blob/base64 vào message state được đồng bộ/realtime.
- File card có trạng thái đang tải xuống và lỗi riêng. Download có giới hạn song song; ảnh lớn/file không được tự tải hàng loạt theo lịch sử chat.
- Modal ảnh có đóng, fit màn hình và tải xuống; dùng chung animation, focus và reduced-motion. Giao diện mobile không che ô chat hay nút gửi.
- Reply snippet cho tin chỉ có tệp dùng nhãn ảnh/tên tệp, không gọi thao tác chuỗi trên body null.
- Biên bản bản đầu có thể ghi tên tệp/thông tin đính kèm cần thiết; chưa nhúng ảnh chat hoặc tạo link công khai vĩnh viễn. Không nhúng session token vào Markdown/PDF.

## 11. Thứ tự triển khai và điều kiện hoàn thành

1. Chốt phạm vi, loại tệp, quota và hợp đồng API; thiết kế state machine, ownership và cách phục hồi SQL/Mongo. Kết quả: DTO/schema/migration/API contract review được, chưa mở upload cho người dùng.
2. Làm storage local, intent, upload stream, quota nguyên tử và hủy upload. Test path containment, quá dung lượng, hết ổ, retry và hai request tranh quota.
3. Thêm nhận dạng/quét tệp, xử lý ảnh và các API đọc có xác thực. Test giả MIME/đuôi, ảnh quá pixel, tệp hỏng, scanner down/timeout và tải chéo phòng/phiên bị thu hồi.
4. Tích hợp attachments vào gửi/lấy/reply tin nhắn và realtime. Test tin chỉ có file, text + nhiều file, ID của người khác, retry cùng client ID, phòng đóng trong lúc upload và lỗi tại từng bước SQL/Mongo.
5. Làm picker/preview/progress/retry, thẻ tệp, thumbnail lazy và modal ảnh. Test mất mạng/đổi phòng/hủy upload, giữ draft khi gửi lỗi, keyboard, reduced-motion và màn hình điện thoại thấp.
6. Tích hợp cleanup/outbox/retention, Docker volume, Nginx, backup và quan sát vận hành. Chạy kiểm thử thật qua proxy bằng cơ sở dữ liệu/test volume riêng; chứng minh restart không mất tệp và purge không còn blob rác sau khi job xử lý xong.

Hoàn thành tính năng khi cả upload ảnh và tài liệu, quyền truy cập, retry/idempotency, xóa hết hạn, cấu hình production và các test lỗi đều đạt. Không coi chỉ hiển thị được một ảnh trong chat là hoàn thành.

## 12. Nguồn đối chiếu

- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Thumbnailator: https://github.com/coobird/thumbnailator
- Apache Tika type detection: https://cwiki.apache.org/confluence/spaces/TIKA/pages/109454101/Troubleshooting%2BTika
- ClamAV stream limits: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
- Tùy chọn R2/Java khi cần mở rộng: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/

Đối chiếu code hiện tại: SendMessageRequest, Message, ChatServiceImpl, RoomRetentionServiceImpl, RateLimitAction/Interceptor, frontend/nginx.conf, ChatInputBar, ChatMessageList và useEventChat.
