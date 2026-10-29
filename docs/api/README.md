# Tạo phòng và thời gian hết hạn

## BranchChat bản cơ bản

- `POST /rooms/{slug}/messages` nhận thêm `threadRootId` (ID tin gốc), tùy chọn. Không gửi trường này là chat chính. `replyToId` chỉ dùng để trích dẫn và phải cùng luồng; không thay thế `threadRootId`.
- Root phải là tin TEXT đã công bố, thuộc đúng phòng và nằm ở chat chính. Tin có tệp được làm root; phản hồi nhánh hiện chỉ nhận văn bản, không nhận attachmentIds. Không tạo nhánh lồng nhánh hoặc nhánh từ SYSTEM.
- `GET /rooms/{slug}/messages/{rootId}/thread?afterSequence=0` yêu cầu session còn quyền đọc. Trả `rootMessage`, `messages` (tối đa 100 phản hồi, tăng dần theo sequence), `nextSequence`, `hasMore`. Client gọi tiếp khi hasMore để không mất lịch sử. Không chấp nhận afterSequence âm.
- `GET /rooms/{slug}/messages/threads?beforeActivitySequence=<cursor>` yêu cầu cùng quyền đọc, trả `threads`, `nextActivitySequence`, `hasMore`. Mỗi nhánh có `rootMessage`, `replyCount`, `lastActivitySequence`, `lastActivityAt`, `lastReplySnippet` (tối đa 160 ký tự và dấu …). Lần đầu bỏ cursor; gọi tiếp bằng `nextActivitySequence` khi `hasMore=true`. Tối đa 50 nhóm mỗi trang, sắp theo sequence phản hồi cuối giảm dần; nhóm trước rồi mới lọc cursor để nhánh đã xuất hiện không lặp lại vì phản hồi cũ. Root không còn tồn tại/không hợp lệ được bỏ qua, cursor vẫn tiến theo nhóm đã quét. Lấy toàn bộ lịch sử còn lưu của phòng, độc lập với 50 tin gần nhất của main. Nhánh chưa có phản hồi chưa xuất hiện trong danh sách.
- MessageResponse thêm `threadRootId` và `threadReplyCount`. GET messages chỉ trả chat chính, kèm số phản hồi lấy bằng aggregation theo batch. Dữ liệu Mongo cũ thiếu trường threadRootId vẫn là chat chính.
- Phản hồi dùng chung sequence theo phòng, unique clientMessageId, rate limit CHAT và topic `/topic/room.{slug}.messages`. Client phân luồng bằng threadRootId; không render phản hồi nhánh vào chat chính. Count trong sự kiện nhánh là tổng đã lưu, không phải số gia; frame trùng không được cộng lần nữa.
- Retry cùng clientMessageId trong nhánh phải giữ nội dung và root; đổi nội dung/root trả 409. Phiên khác không được dùng lại mã tin của người khác.
- CLOSED/EXPIRED chặn gửi; session bị kick mất quyền đọc/ghi/nhận sự kiện. Tin nhánh giữ đến expiresAt phòng + 7 ngày, dọn bằng TTL và job theo roomId hiện có.
- Mongo tự tạo index `idx_room_thread_seq` khi `spring.data.mongodb.auto-index-creation=true`; giữ cấu hình này hoặc tạo index tương đương trước khi bật chức năng trên dữ liệu lớn. Không cần migration SQL mới cho BranchChat.
- Frontend: tách nút “Trích dẫn vào kênh chính” và nút mở nhánh. Màn hình từ 1280 px đặt nhánh ở cột phải cạnh chat chính; màn hình nhỏ hơn dùng Drawer, mobile toàn màn hình. Tin gốc nằm cố định phía trên danh sách phản hồi, có thể mở xem đầy đủ. Ô nhập ghi rõ chỉ gửi vào nhánh. Nháp văn bản được giữ riêng theo nhánh trong phiên hiện tại, kể cả đóng/mở hoặc đổi kích thước màn hình; gửi thành công mới xóa. Khi đang đọc phía trên có phản hồi mới, hiện nút quay xuống. Đóng rồi mở lại tải từ server; reconnect tải lại nhánh đang mở. Chưa có danh sách toàn bộ nhánh, gửi tệp trong nhánh, unread đồng bộ nhiều thiết bị hoặc lưu nháp qua tải lại trang.

API attachment hiện dùng [multipart đơn giản](../tutorials/attachments/06-multipart.md), mô tả trong [OpenAPI](openapi.json). POST nhận field file, trả READY sau kiểm tra filename/size và signature ảnh; không có antivirus/intent/PUT/status polling. Chat nhận tối đa 4 attachmentIds, cho phép body trống khi có tệp. Download/preview yêu cầu session còn quyền; không đặt token trong URL.

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

Khi khóa, lượt join mới trả 409 trước khi đếm capacity hoặc tạo session; các phiên hiện có vẫn reconnect và tương tác theo quyền/trạng thái phòng. GET chi tiết phòng trả `data.joinLocked`. Join và cập nhật khóa cùng lấy pessimistic lock trên hàng Room, thao tác lấy khóa trước được xử lý trước. Cache bị xóa sau commit. Frontend có nút khóa/mở trong khu vực Host khi phòng ACTIVE và có Host token; nút chặn nhấn lặp trong lúc gửi, chỉ cập nhật sau ACK và giữ trạng thái khi API lỗi. Sau commit, topic `.events` phát `JOIN_LOCK_CHANGED` để các trình duyệt tải lại trạng thái từ REST.

Flyway V4 thêm `rooms.join_locked BOOLEAN NOT NULL DEFAULT FALSE`, giữ phòng hiện có mở lượt tham gia.

### Kick và thu hồi session

`POST /api/v1/rooms/{slug}/participants/{guestId}/kick`, header `X-Host-Token`, không cần body. Chỉ Host hợp lệ được gọi (403 khi thiếu/sai token); phòng phải ACTIVE và chưa hết TTL. Không được kick Host; thành viên không thuộc phòng trả 400. Kick thành công trả 200; gọi lại không đổi thời điểm thu hồi. Endpoint áp dụng HOST_WRITE rate limit.

Flyway V5 thêm `room_sessions.revoked_at TIMESTAMP(6) NULL`. Session bị thu hồi vẫn giữ trong lịch sử, không tính capacity và không xuất hiện trong danh sách participants. Room/Poll/Wheel/Decision xác thực qua truy vấn `revokedAt IS NULL`; xác thực chat qua SessionCacheService cũng kiểm tra SQL mỗi lần thay vì tin Redis snapshot. Reconnect và kick cùng khóa hàng Room để reconnect không ghi đè trạng thái thu hồi.

Frontend có nút loại thành viên dành cho Host có Host token khi phòng ACTIVE, xác nhận trước khi gọi API, chặn nhấn lặp và chỉ bỏ thành viên khỏi danh sách sau ACK. API lỗi giữ nguyên danh sách và hiển thị thông báo. Nút không xuất hiện cho thành viên Host.

GET chi tiết phòng, messages, polls, wheels, lịch sử spins và decisions yêu cầu `X-Session-Token` còn hiệu lực thuộc đúng phòng qua `RoomAccessService`. Thiếu/sai token, token phòng khác hoặc đã thu hồi trả 403 trước khi gọi service đọc dữ liệu. Phiên còn hiệu lực vẫn đọc được phòng CLOSED. Export giữ xác thực Host riêng.

Frontend chỉ tải dữ liệu riêng tư khi session có token và khớp slug, kết nối WebSocket sau khi GET chi tiết phòng thành công; nhận realtime trong lúc lịch sử còn tải. Khi đổi phòng hoặc mất session, dữ liệu phòng cũ bị xóa và callback cũ bị bỏ qua.

Sau commit, kick ngắt các socket của guest trên instance hiện tại và phát `MEMBER_KICKED` trên topic `.events`. Instance khác kiểm tra SQL trước outbound MESSAGE và rà lại cả socket idle mỗi 5 giây. Thu hồi token không ngăn một người tạo phiên mới bằng liên kết nếu phòng vẫn mở lượt join.

### WebSocket, presence và quyền Host

SockJS endpoint `/ws` (raw STOMP `/ws/websocket`). CONNECT phải có native headers `X-Room-Slug` và `X-Session-Token`; token được kiểm tra SQL theo đúng phòng và `revokedAt IS NULL`, xóa khỏi headers trước khi gửi broker. Principal do server tạo, không tin danh tính client tự khai.

SUBSCRIBE chỉ cho phép đúng `/topic/room.{slug}.messages`, `.polls`, `.decisions`, `.wheels`, `.wheels.*.spins`, `.events`. Client không được SEND tới bất cứ destination nào; thao tác ghi dùng REST để giữ quyền, transaction và rate limit. Outbound MESSAGE được kiểm tra lại tại handler trước khi gửi socket; SQL lỗi cũng chặn gửi. Gói đang gửi trước thời điểm revoke commit có thể đã đến client. Server giới hạn frame 8 KiB, buffer 64 KiB, thời gian gửi 10 giây và thời gian đợi frame đầu 10 giây. `app.allowed-origins` là danh sách origin chính xác dùng chung REST/WebSocket.

`GET /rooms/{slug}/presence` yêu cầu session còn quyền đọc, trả danh sách guestId online. Redis sorted set dùng từng socket làm thành viên nên nhiều tab/instance không ghi đè nhau; heartbeat refresh mỗi 5 giây, crash hết hiệu lực sau 30 giây. UI tải presence ngay sau CONNECT và khi nhận `PRESENCE_CHANGED` trên topic `.events`; poll 10 giây chỉ là dự phòng. Server phát sự kiện khi CONNECTED/DISCONNECT và dọn presence trước thông báo ngắt kết nối. Snapshot cũ không ghi đè kết quả mới; khi chưa tải được presence, UI hiển thị “Đang cập nhật…” thay vì gán offline. Đây là trạng thái kết nối, không phải số slot đã giữ.

Tạo Poll yêu cầu session HOST. Wheel create/spin cũng yêu cầu HOST. Frontend gửi PATCH để chốt/từ chối Decision; xóa/thu hồi dùng DELETE như mô tả bên dưới.

### Cập nhật phiếu và dọn quyết định

- `PUT /rooms/{slug}/polls/{pollId}/votes`, header `X-Session-Token`, body `{ "optionIds": [10, 11] }`: thay thế toàn bộ lựa chọn của phiên hiện tại trong một transaction. Chọn một nhận tối đa 1 ID, chọn nhiều nhận tối đa 10 ID; không nhận ID trùng, null, âm hoặc phương án thuộc poll khác. `[]` rút toàn bộ phiếu. Chỉ cho phép khi poll OPEN và phòng ACTIVE, chưa hết hạn. Retry cùng danh sách không cộng thêm phiếu. POST cũ vẫn giữ hành vi gửi từng phiếu để tương thích client cũ.
- Poll response có `revision` tăng mỗi lần thay đổi phiếu hoặc đóng poll. Snapshot REST và realtime dùng số này để không ghi đè kết quả mới bằng kết quả cũ; số phiếu có thể giảm. REST riêng tư trả `votedOptionIds`, realtime không công bố lựa chọn cá nhân.
- `DELETE /rooms/{slug}/decisions/{decisionId}`, header `X-Session-Token`: host hoặc tác giả được xóa đề xuất chưa chốt (status `DELETED`); chỉ host được thu hồi quyết định CONFIRMED (status `WITHDRAWN`). Không xóa bản ghi; giữ nội dung và thời điểm chốt, phát cập nhật realtime sau commit. GET decisions vẫn trả lịch sử. Retry thao tác đã xong là idempotent. Phòng đã đóng/hết hạn hoặc session bị thu hồi không được ghi.
- Decision response có `creatorGuestId` để UI xác định tác giả. Danh sách chính ẩn DELETED/WITHDRAWN/REJECTED, có mục lịch sử thu gọn. Export chỉ lấy CONFIRMED nên không đưa quyết định đã thu hồi vào kết luận hiện tại.
- Decision response trả riêng `creatorNickname`/`creatorGuestId` và `confirmedByNickname`/`confirmedByGuestId`. PATCH status nhận thêm `X-Session-Token` tùy chọn bên cạnh `X-Host-Token`: khi có, session phải còn hiệu lực, thuộc đúng phòng và có vai trò HOST; server lưu bản chụp danh tính tại thời điểm chuyển sang CONFIRMED. Không nhận danh tính người chốt từ body. Thu hồi giữ nguyên thông tin người chốt và `confirmedAt`. Client cũ chỉ gửi host token vẫn hoạt động nhưng không có danh tính phiên để ghi nhận. Migration V9 thêm hai cột nullable; không suy đoán người chốt cho dữ liệu cũ. UI hiển thị “Chưa ghi nhận” khi thiếu dữ liệu, giữ nguyên ISO timestamp và hiển thị ngày giờ đầy đủ, kèm số lượt tán thành.
- POST decisions nhận `sourceSpinId` tùy chọn: chỉ HOST, lượt quay phải thuộc phòng. `text` là việc cần quyết định; server ghép `text → kết quả thật của lượt quay`, thêm ghi chú và `wheel-spin:<id>` vào evidenceRefs. Mỗi lượt quay chỉ tạo một đề xuất, retry trả bản ghi cũ kể cả khi đã xóa/thu hồi. Không gửi trực tiếp tham chiếu `wheel-spin:` trong evidenceRefs. Khóa Room tuần tự hóa các yêu cầu lưu cùng lượt quay.

### Export, reply và retention

Frontend export chỉ dành cho Host, dùng nguyên `markdownSummary` của API cho preview/copy/download/share; không tự dựng báo cáo từ một poll hoặc ngày mẫu. Clipboard lỗi và hủy share không được báo thành công. Poll OPEN được ghi rõ kết quả tạm thời; báo cáo gồm tất cả polls/wheels và confirmed decisions.

Reply UI gửi `replyToId`; server kiểm tra tin gốc thuộc phòng. Wheel UI gửi `excludeWinner`; kết quả và danh sách còn lại được lưu server và broadcast sau commit. Capacity hiển thị theo `maxParticipants` server.

Retention cố định 7 ngày sau `expiresAt`, V6 đồng bộ metadata/default policy. Job chạy theo lô 25 phòng, khóa Room và kiểm tra lại cutoff, xóa Mongo trước rồi SQL theo thứ tự FK, dọn known Redis keys sau commit. Job có thể chạy lại; Mongo/SQL không có distributed rollback nên Mongo đã xóa không được hoàn lại nếu SQL thất bại. Rate-limit/presence keys tự hết TTL. Cấu hình lịch `app.retention.interval-ms` (mặc định 1 giờ) và `initial-delay-ms` (1 phút).
