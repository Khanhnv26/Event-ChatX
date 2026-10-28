# Tạo phòng và thời gian hết hạn

`POST /api/v1/rooms`

```json
{
  "title": "Thảo luận nhóm",
  "hostNickname": "Host",
  "ttlMinutes": 30
}
```

- `ttlMinutes`: số nguyên JSON, từ 5 đến 10.080 phút, tùy chọn.
- `ttlHours`: trường tương thích cho client cũ, số nguyên JSON từ 1 đến 168 giờ, tùy chọn.
- Chỉ gửi một trong hai trường. Nếu bỏ cả hai hoặc để cả hai là `null`, mặc định 24 giờ.
- Gửi cả hai giá trị, giá trị ngoài giới hạn, số thập phân hoặc chuỗi thay cho số trả HTTP 400.
- Server tính `expiresAt` từ thời điểm tạo phòng. Response và schema database giữ nguyên.
- Hết hạn phòng chặn join/chat/vote/spin theo `expiresAt`, không chờ job cập nhật trạng thái. Việc này không thay đổi chính sách lưu hoặc xóa dữ liệu.

## Giới hạn thành viên

- Mỗi phòng mặc định có `maxParticipants=50`, lưu trong cột `rooms.max_participants` từ migration V3. Response `GET /api/v1/rooms/{slug}` trả thêm `maxParticipants`.
- Đếm toàn bộ session đã tạo trong phòng, bao gồm Host. Đây là số phiên giữ chỗ, không phải số người đang online; đóng tab không tự giải phóng chỗ.
- Join lấy khóa Room rồi đếm session và ghi session mới trong cùng transaction READ_COMMITTED. Khi phòng đầy, trả HTTP 409 với `success=false`, không tạo session hoặc phát MemberJoinedEvent.
- Phòng đã có nhiều session hơn giới hạn cũng từ chối join mới; migration không xóa các session hiện hữu.
- Reconnect dùng lại session hiện có nên không tăng số lượng và vẫn hoạt động khi phòng đầy theo quy tắc vòng đời phiên hiện tại.

Flyway tự áp dụng `V3__add_room_capacity.sql` khi ứng dụng khởi động nếu database chưa ở V3. Không sửa migration V1/V2 hoặc chạy lại ALTER thủ công sau khi Flyway đã ghi nhận V3.

Chạy kiểm thử contract bằng Java 21 trong thư mục `backend`:

```powershell
mvn -Dtest=RoomExpiryContractTest test
```

## Đồng thời với thao tác đóng phòng

Join và các thao tác ghi chat/Poll/Wheel/Decision lấy khóa Room từ SQL trước khi kiểm tra trạng thái. Các thao tác sửa công cụ tiếp tục lấy khóa Poll/Wheel/Decision sau khóa Room. Nếu đóng phòng commit trước, thao tác ghi đang chờ bị từ chối; nếu thao tác ghi lấy khóa trước, nó hoàn thành rồi phòng mới đóng. Các truy vấn đọc tiếp tục hoạt động theo chính sách hiện tại.

Chat kiểm tra quyền ghi từ dòng SQL đã khóa, không dùng trạng thái Redis cache để quyết định có cho ghi hay không. Tin được lưu vào MongoDB trong lúc giữ khóa Room và chỉ broadcast sau khi transaction SQL commit. Đây không phải distributed transaction giữa SQL và MongoDB; lỗi commit SQL sau khi MongoDB đã lưu vẫn có thể để lại tin cần phục hồi qua history/idempotency. Cache phòng được invalidation sau commit của close/expiry; cache trạng thái phục vụ đọc không phải nguồn quyết định quyền ghi.

## Rate limit bằng Redis Token Bucket

Các request ghi REST dưới `/api/v1/rooms` được kiểm tra trước controller. Một Lua script dùng thời gian Redis để kiểm tra và tiêu thụ đồng thời các bucket của request; nếu một bucket thiếu token, không bucket nào bị trừ token. Mỗi request được chấp nhận tiêu thụ một token mỗi bucket, bao gồm request retry. Các luồng ghi hiện tại dùng REST; đây không phải bộ giới hạn lưu lượng STOMP/broker.

Mặc định:

- Tạo phòng: bucket theo IP, capacity 3, refill khoảng 1 token/phút.
- Join/reconnect: theo IP capacity 20, refill 1 token/giây; thêm bucket phòng capacity 50, refill 5 token/giây.
- Mọi thao tác ghi trong phòng: thêm bucket IP capacity 30, refill 5 token/giây và bucket phòng capacity 100, refill 50 token/giây.
- Chat: bucket phòng + hash session token, capacity 5, refill 0,5 token/giây.
- Tạo Poll/Wheel/Decision: bucket công cụ chung theo phòng + hash session token, capacity 3, refill 0,1 token/giây.
- Vote Poll/xác nhận Decision: capacity 10, refill 2 token/giây theo phòng + hash session token.
- Spin: capacity 3, refill 0,5 token/giây theo phòng + hash session token.
- Đóng phòng/đóng Poll/đổi trạng thái Decision: capacity 5, refill 1 token/giây theo phòng + hash Host token.

Token Bucket cho phép burst khi bucket đầy. Chat capacity 5/refill 0,5 không có nghĩa giới hạn cứng 5 tin trong mọi cửa sổ 10 giây. Hạn mức theo IP có thể được chia sẻ bởi người cùng mạng; ngưỡng cần hiệu chỉnh bằng tải thực tế.

Token chưa được xác thực ở interceptor: limiter hash token để nhóm request, còn service kiểm tra token/quyền như trước. Bucket IP và phòng giới hạn cả người thay token liên tục. Raw token và IP không được lưu trong tên key.

Hết token trả HTTP 429, header `Retry-After` là số giây nguyên làm tròn lên và body `ApiResponse` có `success=false`. Redis lỗi hoặc trả kết quả không hợp lệ: thao tác ghi trả 503 với `Retry-After: 1`, không âm thầm bỏ qua limiter. Các request GET không qua limiter này. Frontend giữ draft chat khi lỗi và đưa thời gian chờ vào thông báo 429; thông báo thành công chỉ xuất hiện sau ACK thành công.

Ngưỡng cấu hình trong `application.properties` dưới `app.rate-limit.*`, gồm `capacity` và `refill-per-second` cho từng bucket. Dùng Redis 7 standalone như Compose hiện tại; script nhiều key chưa hỗ trợ Redis Cluster cross-slot. Bucket tự hết TTL sau khoảng thời gian hồi đầy. Có thể đổi `app.rate-limit.key-prefix` để tách namespace giữa các môi trường.

Mặc định lấy IP từ peer kết nối và bỏ qua `X-Forwarded-For`. Khi có reverse proxy, đặt `app.rate-limit.trusted-proxies` thành danh sách IP literal của proxy đáng tin cậy; xử lý chuỗi từ phải sang trái và lấy peer không tin cậy đầu tiên. Giữ `server.forward-headers-strategy=NONE` để header chưa được framework biến thành địa chỉ peer trước khi interceptor kiểm tra. Không đưa địa chỉ client thông thường vào danh sách proxy tin cậy.

Tài liệu kỹ thuật: [Redis Lua scripting và tính nguyên tử](https://redis.io/docs/latest/develop/programmability/eval-intro/).

### Cấu trúc mã rate limit

- `common/ratelimit/config`: cấu hình ngưỡng và đăng ký interceptor.
- `common/ratelimit/interceptor`: đọc thông tin HTTP, phân loại action, gọi `RateLimitService`.
- `common/ratelimit/service` và `service/impl`: hợp đồng kiểm tra và chọn các bucket theo action/IP/phòng/actor.
- `common/ratelimit/model` và `enums`: context, bucket, policy và action; không phụ thuộc Servlet hoặc Redis.
- `common/security/ClientIpResolver`: phân giải địa chỉ client qua danh sách proxy tin cậy.
- `common/exception`: exception 429/503 dùng chung với `GlobalExceptionHandler`.
- `infrastructure/redis/RedisTokenBucket` và `RedisKeys`: thực thi Lua và quy tắc tạo key; script ở `resources/redis/token-bucket.lua`.

Luồng xử lý: interceptor → `RateLimitService` → Redis Token Bucket → Lua. Redis key, `app.rate-limit.*`, ngưỡng và contract HTTP được giữ nguyên khi tổ chức lại package.

### Host khóa/mở lượt tham gia mới

`PATCH /api/v1/rooms/{slug}/join-lock`, header `X-Host-Token`, body `{"joinLocked":true}` để khóa hoặc `{"joinLocked":false}` để mở. Trả 200 với `ApiResponse` thành công; gửi lại cùng trạng thái không ghi lại. Trường `joinLocked` bắt buộc và không được null. Thiếu/sai Host token trả 403; phòng không ACTIVE hoặc hết TTL trả 400. Endpoint áp dụng bucket HOST_WRITE.

Khi khóa, lượt join mới trả 409 trước khi đếm capacity hoặc tạo session; các phiên hiện có vẫn reconnect và tương tác theo quyền/trạng thái phòng. GET chi tiết phòng trả `data.joinLocked`. Join và cập nhật khóa cùng lấy pessimistic lock trên hàng Room, thao tác lấy khóa trước được xử lý trước. Cache bị xóa sau commit. Frontend có nút khóa/mở trong khu vực Host khi phòng ACTIVE và có Host token; nút chặn nhấn lặp trong lúc gửi, chỉ cập nhật sau ACK và giữ trạng thái khi API lỗi. Trạng thái được tải lại khi mở phòng hoặc reconnect. Chưa có sự kiện realtime riêng cho thay đổi khóa giữa các trình duyệt.

Flyway V4 thêm `rooms.join_locked BOOLEAN NOT NULL DEFAULT FALSE`, giữ phòng hiện có mở lượt tham gia.
