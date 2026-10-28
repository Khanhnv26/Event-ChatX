# Kế hoạch hoàn thiện EventChat MVP V1

Ngày chốt: 27/10/2026.

Kế hoạch đối chiếu tài liệu `docs/requirements/EventChat_SRS_V1.docx` với mã nguồn hiện tại. Mục tiêu là hoàn thiện và nghiệm thu FR-01 đến FR-10 cùng các yêu cầu phi chức năng cần thiết cho MVP. Kế hoạch được chốt để làm căn cứ triển khai; các mục bên dưới chưa được coi là đã thực hiện.

## Phạm vi và quyết định

- TTL mặc định 24 giờ, cho phép cấu hình từ 5 phút đến 7 ngày.
- Host tạo/đóng Poll, tạo/quay Wheel, chốt Decision, quản lý phòng/thành viên và xuất báo cáo.
- Participant chat, bỏ phiếu Poll, tạo đề xuất Decision và tán thành/phản đối Decision.
- Host chốt Decision bằng thao tác rõ ràng; phiếu tán thành/phản đối hỗ trợ quyết định, không tự động chốt theo đa số.
- Chỉ phòng ACTIVE và chưa quá expiresAt cho phép thay đổi nội dung. CLOSED/EXPIRED từ chối thao tác ghi; cho phép đọc theo quyền trong thời hạn lưu trữ. Tác vụ dọn dữ liệu của hệ thống là ngoại lệ.
- Khóa nhận thành viên mới tách biệt với đóng phòng; các thành viên hiện hữu vẫn hoạt động khi phòng bị khóa join.
- Chỉ Host được xuất báo cáo.
- Giữ dữ liệu đến 7 ngày sau expiresAt, sau đó dọn dữ liệu liên quan và cache. Đóng phòng sớm không tự thay đổi expiresAt.
- V1 chưa hỗ trợ upload file/ảnh và khôi phục Host token bị mất.
- Kiến trúc triển khai: React/TypeScript, Java 21/Spring Boot, MySQL cho dữ liệu quan hệ, MongoDB cho tin nhắn, Redis cho cache/rate limit/sequence và RabbitMQ cho STOMP relay. Cập nhật SRS cho đúng kiến trúc này.
- Ngoài đợt này: BranchChat, AI Summary, PDF, Discord Bridge và Workshop. Markdown hiện có được hoàn chỉnh trong luồng export, không mở rộng thành hệ thống xuất tài liệu mới.

## Rate limit đã chốt

Dùng Token Bucket lưu trong Redis, cập nhật nguyên tử bằng Lua script, dùng chung giữa các backend instance. Không dùng bộ đếm trong bộ nhớ của từng instance làm nguồn quyết định giới hạn.

- Mỗi bucket lưu số token còn lại và thời điểm cập nhật; kiểm tra, refill và tiêu thụ token trong cùng script.
- Dùng thời gian Redis để tránh lệch đồng hồ giữa backend instance; đặt TTL dựa trên thời gian bucket hồi đầy để dọn bucket không hoạt động.
- Chat dùng bucket theo roomId + sessionId; các thao tác tạo Poll/Wheel/Decision có bucket riêng.
- Create/join dùng bucket theo IP do chưa có session; chỉ tin forwarded IP từ proxy được cấu hình tin cậy. Ngưỡng cần tính đến mạng dùng chung.
- Bổ sung bucket tổng theo phòng cho thao tác ghi để giảm spam bằng nhiều session. Khi một request cần nhiều bucket, kiểm tra và tiêu thụ nguyên tử để không trừ token một phần khi request bị từ chối.
- Ngưỡng chat ban đầu: capacity 5 token, refill 0,5 token/giây, chi phí 1 token/request. Cho phép burst 5 tin khi đầy; không diễn giải là giới hạn cứng 5 tin trong mọi cửa sổ 10 giây.
- Các ngưỡng khác cấu hình theo hành động, ghi rõ trong tài liệu triển khai và hiệu chỉnh qua load test; không hardcode rải rác.
- Hết token trả HTTP 429 và Retry-After. Request bị từ chối không được lưu hoặc broadcast; UI giữ nội dung và hiển thị thời gian chờ.
- Redis không khả dụng: không âm thầm bỏ qua rate limit; trả lỗi tạm thời 503 cho thao tác cần limiter, giữ khả năng đọc khi các phụ thuộc khác cho phép.
- Kick/ban session không bảo đảm ngăn một người ẩn danh quay lại bằng danh tính mới. Đây là giới hạn của V1, cần ghi rõ.

## Giai đoạn 1 Chốt và cập nhật đặc tả

Ước lượng: 0,5–1 ngày.

- Cập nhật mục 8 và mục 12 của SRS theo các quyết định trên.
- Ghi rõ quyền theo vai trò, chuyển trạng thái phòng/Decision, retention và giới hạn dữ liệu đầu vào.
- Ngưỡng khởi điểm để kiểm thử: 50 thành viên/phòng, tin nhắn tối đa 2.000 ký tự. Đây là cấu hình thử nghiệm cần xác nhận bằng tải thực tế, không phải cam kết năng lực đã đo.
- Định nghĩa cách đếm thành viên cho giới hạn phòng, hành vi reconnect và việc giải phóng chỗ khi thành viên bị loại.

Nghiệm thu: không còn quyết định nghiệp vụ ảnh hưởng MVP bị bỏ ngỏ; các giá trị cấu hình có một nguồn mô tả thống nhất.

## Giai đoạn 2 Quyền truy cập và tính nhất quán

Ước lượng: 2–3 ngày. Phụ thuộc giai đoạn 1.

- Bảo vệ export JSON và Markdown bằng Host token.
- Chuẩn hóa kiểm tra token, session thuộc phòng, vai trò và trạng thái/thời hạn phòng ở server.
- Áp dụng quyền Host-only khi tạo Poll; giữ quyền đề xuất Decision của Participant.
- Chặn tạo, bỏ phiếu và thay đổi Decision khi phòng không còn ghi được.
- Ràng buộc chuyển trạng thái Decision hợp lệ, không sửa quyết định đã CONFIRMED.
- Rà soát quyền đọc lịch sử/dữ liệu phòng và xác thực, phân quyền đăng ký STOMP topic.
- Phát sự kiện Decision sau transaction commit.
- Xử lý tình huống close đồng thời với chat/vote/spin/decision, định nghĩa rõ thời điểm thao tác được chấp nhận; chú ý tính nhất quán giữa MySQL, MongoDB và cache.

Nghiệm thu: test token thiếu/sai/khác phòng; Participant không vượt quyền; CLOSED/EXPIRED từ chối ghi; rollback không phát sự kiện thành công; có kiểm thử cạnh tranh với close.

## Giai đoạn 3 Chống spam và quản lý thành viên

Ước lượng: 2–3 ngày. Phụ thuộc giai đoạn 2.

- Triển khai Redis Token Bucket + Lua theo thiết kế đã chốt.
- Giới hạn số thành viên và kiểm soát join đồng thời.
- Chuẩn hóa độ dài nickname, tên phòng, tin nhắn, câu hỏi, lựa chọn và danh sách wheel.
- Thêm khóa/mở khóa join, kick/vô hiệu hóa session; cập nhật cache, quyền STOMP và thông báo client.
- Thêm giao diện quản lý thành viên cho Host và thông báo rate limit cho người dùng.

Nghiệm thu: refill/burst/Retry-After đúng; nhiều backend không nhân hạn mức; request đồng thời không vượt token hoặc số người; session bị kick không tiếp tục đọc/ghi dữ liệu được bảo vệ; Redis lỗi trả 503 theo chính sách.

## Giai đoạn 4 Hoàn chỉnh giao diện chức năng

Ước lượng: 2–3 ngày. Phụ thuộc giai đoạn 2–3.

- Reply: chọn tin gốc, xem trước, hủy chọn, gửi replyToId và hiển thị liên kết với tin gốc.
- Wheel: thêm tùy chọn excludeWinner, cập nhật danh sách sau quay và phục hồi đúng sau refresh/reconnect.
- Decision: hiển thị trạng thái, số phiếu, quyền thao tác và tham chiếu poll/wheel/message hợp lệ; server kiểm tra tham chiếu thuộc cùng phòng.
- Chỉ báo thành công sau ACK từ server; lỗi giữ nội dung biểu mẫu và hiển thị cho người dùng.
- Thay isOnline gán cứng bằng trạng thái kết nối thực; phân biệt danh sách từng tham gia với người đang online.
- Kiểm tra bàn phím, focus modal, mobile và reduced motion.

Nghiệm thu: luồng hoàn chỉnh qua UI, không cần gọi API thủ công; thông báo đúng kết quả server; refresh/reconnect giữ đúng kết quả.

## Giai đoạn 5 Báo cáo và vòng đời dữ liệu

Ước lượng: 2–3 ngày. Phụ thuộc giai đoạn 2 và hợp đồng dữ liệu giai đoạn 4.

- Nối màn hình báo cáo với API export đã bảo vệ; dùng cùng nguồn dữ liệu cho xem trước/copy/download.
- Tổng hợp tất cả Poll, lịch sử Wheel và Decision đã chốt; gắn nhãn kết quả Poll còn mở là tạm thời.
- Bỏ ngày/giờ mẫu, dùng exportedAt và thông tin xác nhận thực từ server. Không gán người đề xuất thành người xác nhận.
- Xử lý lỗi clipboard/share và hủy share; không báo đã gửi sang nền tảng ngoài khi chưa có xác nhận.
- Thực thi retention cho MongoDB/MySQL/cache; dọn quan hệ theo thứ tự an toàn, theo lô và có thể chạy lại.
- Công bố chính sách dữ liệu, quyền xuất và giới hạn ẩn danh ở bước join.

Nghiệm thu: export khớp server và đầy đủ công cụ; dữ liệu quá hạn được dọn theo chính sách; job chạy lại không làm hỏng dữ liệu.

## Giai đoạn 6 Self-host và vận hành

Ước lượng: 1,5–2,5 ngày. Thực hiện sau khi các hợp đồng chính ổn định.

- Dockerfile frontend/backend; Compose đủ ứng dụng và các phụ thuộc.
- Reverse proxy, WebSocket, cấu hình TLS, health check và quản lý biến môi trường.
- .env.example, README setup/migration/backup/khôi phục/reset môi trường phát triển.
- OpenAPI, LICENSE, CONTRIBUTING, SECURITY và tài liệu kiến trúc. Chọn MIT làm giấy phép dự án, kiểm tra khả năng tương thích của các phụ thuộc trước khi phát hành.
- CI chạy build/lint/test; không đưa secrets hoặc dữ liệu thật vào repository.
- Log có request/room correlation ID, không ghi token/nội dung chat; metrics cho lỗi, độ trễ, rate limit và kết nối.

Nghiệm thu: chạy được từ môi trường sạch theo README; health check phản ánh phụ thuộc; CI xanh và cấu hình mẫu không chứa secrets thật.

## Giai đoạn 7 Nghiệm thu trên hạ tầng thật

Ước lượng: 2–3 ngày. Phụ thuộc các giai đoạn trước.

- Host và ít nhất hai Participant trên nhiều phiên trình duyệt.
- Refresh, reconnect, mất mạng, request retry và phục hồi dữ liệu.
- Vote/spin đồng thời, close đồng thời với thao tác ghi, hết hạn và dọn dữ liệu.
- Vượt quyền, đọc/subscribe khác phòng, spam, kick và export.
- Load test ghi rõ máy chủ, số phòng/người, tốc độ gửi, payload và thời gian đo; kiểm tra p95 gửi–nhận dưới 1 giây trong cấu hình thử nghiệm đã công bố. Kiểm tra limiter với nhiều backend instance.
- Kiểm tra desktop, thiết bị di động thật và khả năng thao tác bằng bàn phím.
- Checklist FR-01 đến FR-10 và NFR, liên kết từng yêu cầu với test/bằng chứng và lỗi còn mở.

Nghiệm thu: tất cả P0 có bằng chứng đạt; không còn lỗi vượt quyền, làm sai kết quả hoặc mất dữ liệu đã được chấp nhận thành công. Chỉ công bố năng lực đã đo.

## Theo dõi và mốc hoàn thành

- Sau mỗi giai đoạn ghi riêng ba trạng thái: đã triển khai, đã kiểm thử, đã nghiệm thu.
- Mốc đầu: hoàn thành giai đoạn 1–2 để thống nhất đặc tả và bảo vệ dữ liệu.
- Mốc hai: hoàn thành giai đoạn 3–5 để đủ chức năng V1 cho người dùng.
- Mốc phát hành: hoàn thành giai đoạn 6–7, cập nhật SRS và danh sách giới hạn còn lại.
- Ước lượng tổng ban đầu 12–18 ngày làm việc cho một người, có thể chạm khoảng 19 ngày nếu mọi giai đoạn đều ở cận trên; điều chỉnh sau kiểm thử hạ tầng và cạnh tranh thực tế. Đây là ước lượng, không phải thời hạn cam kết.

