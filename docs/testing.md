# Kiểm thử chat, bình chọn và vòng quay

Yêu cầu: Node.js và Java 21; Maven có sẵn trong PATH.

## Frontend

Chạy trong thư mục `frontend`:

```powershell
npm ci
npm test
npm run build
npm run lint
```

Kiểm thử dùng Vitest, React Testing Library và jsdom. Các tình huống gồm phản hồi gửi tin qua REST, nhận tin trùng/lệch thứ tự, khôi phục nhiều trang lịch sử sau reconnect, nhận diện theo guest ID, phiếu đơn/đa lựa chọn, gửi thất bại, chọn poll cũ, giữ nội dung biểu mẫu và vòng quay lỗi.

Các kiểm thử UI bổ sung xác minh animation con trỏ không render lại biểu mẫu, dừng khi ổn định, tôn trọng reduced motion, giải phóng Lenis khi vào phòng, đồng hồ không render lại danh sách chat và giữ vị trí khi đang đọc tin cũ. Preloader dùng một overlay toàn màn hình cho các request đồng thời, hiển thị tối thiểu 1,5 giây rồi mờ dần trong 300ms; dữ liệu tải chậm tiếp tục giữ overlay. Kiểm thử hook cũng xác minh phòng mở được khi API công cụ chậm hoặc lỗi. Đây là kiểm tra hành vi/render trong jsdom, không phải benchmark FPS trên thiết bị thật.

Nút hiệu ứng ✨ trên thanh điều hướng cho phép chọn chuyển động đầy đủ hoặc giảm chuyển động cho riêng EventChat; lựa chọn được lưu và đồng bộ giữa các tab. Khi chưa có lựa chọn, ứng dụng dùng thiết lập hệ thống. Kiểm thử motion bao gồm đóng/mở nhanh modal, thời gian unmount sau exit, không chạy lại hiệu ứng tin nhắn khi nhận ACK, và parallax trong cửa sổ desktop hẹp.

## Backend

Chạy trong thư mục `backend` bằng Java 21:

```powershell
mvn test
```

Nếu Mockito không attach được Java agent trên Windows, chạy cùng JVM và preload agent tương ứng dependency của dự án:

```powershell
$agentPath = Join-Path $env:USERPROFILE '.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar'
$previousMavenOpts = $env:MAVEN_OPTS
try {
    $env:MAVEN_OPTS = "$previousMavenOpts -javaagent:`"$agentPath`""
    mvn '-DforkCount=0' test
} finally {
    $env:MAVEN_OPTS = $previousMavenOpts
}
```

Chạy `mvn test` trước để Maven tải dependency nếu file agent chưa có trong local repository.

Kiểm thử service dùng JUnit và Mockito. `PollConcurrencyTest` dùng database H2 riêng trong bộ nhớ, repository JPA và transaction thật để kiểm tra 8 yêu cầu bỏ phiếu đồng thời. Các kiểm thử không kết nối hay thay đổi database của ứng dụng.

`RoomExpiryContractTest` chạy controller, validation, JSON binding và service tạo phòng với repository giả lập để kiểm tra `ttlMinutes`, tương thích `ttlHours`, mặc định 24 giờ và lỗi 400. Contract được ghi ở `docs/api/README.md`. Các kiểm thử expiry bổ sung xác minh phòng vẫn mang trạng thái ACTIVE nhưng đã quá `expiresAt` phải từ chối join/chat/vote/spin, không chờ lịch job.

`ExportServiceImplTest` kiểm tra Host token thiếu/trắng/sai/khác phòng, từ chối session token của Participant, quyền xuất phòng CLOSED và việc chỉ đưa Decision CONFIRMED vào báo cáo. `ExportAuthorizationContractTest` chạy controller và service thật với repository giả lập để kiểm tra HTTP 403 trên cả JSON/Markdown, đồng thời xác minh Host hợp lệ nhận báo cáo JSON hoặc file Markdown UTF-8.

`DecisionServiceImplTest` kiểm tra cả ba thao tác tạo/bỏ phiếu/cập nhật Decision khi phòng CREATED/CLOSED/EXPIRED hoặc ACTIVE nhưng quá hạn. Test cũng kiểm tra quyền chốt, khả năng đọc phòng CLOSED và việc phát sự kiện sau commit hoặc không phát khi rollback. Các kiểm tra transaction dùng Spring AOP/transaction synchronization với transaction manager dành riêng cho test và repository giả lập; chúng không chứng minh rollback dữ liệu trong database thật.

Các test chuyển trạng thái Decision bao phủ đủ 16 cặp trạng thái hiện tại/đích, từ chối đích null, kiểm tra `confirmedAt` và không lưu/phát sự kiện khi yêu cầu bị từ chối. Test HTTP đi qua controller/service thật với repository giả lập để xác minh chuyển trạng thái sai và bỏ phiếu ngoài PROPOSED trả 400; thiếu trạng thái bị validation chặn trước khi gọi service. Phạm vi này chưa kiểm chứng nhiều yêu cầu đổi trạng thái đồng thời trên database thật.

`DecisionConcurrencyTest` dùng repository JPA, transaction thật và H2 riêng để kiểm tra 8 yêu cầu chốt/từ chối đồng thời chỉ commit một kết quả, 8 phiếu từ cùng guest chỉ tạo một confirmation, phiếu chờ khóa bị từ chối khi Decision đã chốt, và truy vấn khóa không lấy Decision khác phòng. Đây là kiểm thử cạnh tranh trên H2, chưa chứng minh hành vi isolation/locking của MySQL triển khai thật. Test service bổ sung mô phỏng phòng hết hạn trong lúc chờ khóa, yêu cầu cả vote và đổi trạng thái phải kiểm tra lại TTL sau khi lấy khóa.

Các test cạnh tranh đóng phòng kiểm tra cả hai thứ tự lấy khóa Room với ba thao tác Decision: đóng trước thì từ chối ghi; ghi trước thì commit xong mới đóng. Tám yêu cầu đóng đồng thời và một lần retry chỉ tạo một sự kiện sau commit, giữ nguyên `closedAt` và chỉ xóa cache một lần. `RoomCloseServiceTest` kiểm tra token thiếu/trắng trước khi lấy khóa, token sai, trạng thái phòng không hợp lệ và đóng lặp lại không tạo tác dụng phụ. Phạm vi này chưa bao phủ đóng phòng đồng thời với chat/Poll/Wheel hoặc tính nhất quán của cache Redis thật.

`RoomInteractionConcurrencyTest` bổ sung 12 trường hợp lấy khóa trước/sau close cho tạo Poll, vote, đóng Poll, tạo Wheel, spin và chat. Dùng H2/transaction thật cho khóa Room và công cụ; MongoDB, sequence và cache được giả lập. Chat được kiểm tra với snapshot cache vẫn ACTIVE trong khi dòng SQL đã CLOSED. `RoomCacheInvalidationTest` xác minh chỉ invalidation sau commit và giữ cache khi rollback.

`RateLimitHttpTest` kiểm tra các route ghi qua controller/interceptor thật: trả 429 + Retry-After trước khi service được gọi, trả 503 khi limiter lỗi, GET không bị chặn và chỉ tin chuỗi proxy đã cấu hình. `RateLimitPropertiesTest` kiểm tra binding/validation ngưỡng cấu hình. Các test frontend bao gồm lỗi 429 với thời gian chờ, giữ draft và không đánh dấu thao tác thất bại là thành công.

### Kiểm thử Lua trên Redis thật

`RedisTokenBucketIntegrationTest` mặc định bỏ qua để `mvn test` không phụ thuộc Redis cục bộ. Chạy Redis 7 trước, sau đó trong thư mục `backend` với Java 21:

```powershell
$env:EVENTCHAT_TEST_REDIS = 'true'
mvn test
Remove-Item Env:EVENTCHAT_TEST_REDIS
```

Có thể đặt `EVENTCHAT_TEST_REDIS_HOST` và `EVENTCHAT_TEST_REDIS_PORT` (mặc định 127.0.0.1:6379). Test dùng key namespace riêng với UUID và chỉ xóa đúng các key đã tạo, không FLUSHDB/FLUSHALL. Bao gồm burst/refill/cap, TTL, đồng hồ đi lùi, không trừ token một phần, 32 request qua hai limiter instance cùng chia sẻ capacity 5, và request HTTP thứ sáu bị Redis thật từ chối trước khi gọi ChatService. Đây không phải load test/SLA hoặc test Redis Cluster.

Test rate limit nằm theo package production: `common/ratelimit` cho cấu hình/interceptor/service, `infrastructure/redis` cho Lua adapter. `RateLimitServiceImplTest` kiểm tra scope và key qua interface `RateLimitService`; `RateLimitWiringTest` kiểm tra Spring đăng ký và nối các bean sau khi refactor.

`RoomCapacityContractTest` kiểm tra HTTP 409 khi phòng có 50 hoặc hơn 50 session, không ghi/phát sự kiện khi đầy, nhận người cuối cùng ở mức 49 và trả `maxParticipants` trong chi tiết phòng. `RoomCapacityConcurrencyTest` dùng H2/transaction thật: 8 request tranh chỗ cuối chỉ nhận 1, tổng session tối đa 50 tính cả Host; reconnect không chiếm thêm chỗ khi phòng đầy. Migration V3 thêm `rooms.max_participants INT NOT NULL DEFAULT 50`; cần kiểm tra Flyway history trước khi áp dụng lên database có dữ liệu.

## Phạm vi xác minh

Các kiểm thử frontend giả lập REST/STOMP. Kiểm thử H2 xác minh lưu poll và xử lý cạnh tranh trong môi trường kiểm thử; chưa thay thế việc chạy nhiều trình duyệt cùng backend, MySQL, MongoDB, Redis và RabbitMQ thật. Cần chạy thêm môi trường đầy đủ để xác minh luồng realtime xuyên suốt.

`RoomJoinLockContractTest` kiểm tra khóa/mở qua PATCH, quyền Host, thiếu/null trạng thái, phòng hết hạn/không ACTIVE, retry cùng trạng thái, join bị khóa trả 409 trước thao tác session, reconnect phiên cũ và trạng thái trong GET. `RoomJoinLockConcurrencyTest` dùng H2 với transaction thật kiểm tra cả hai thứ tự join/khóa: request sau đợi Room lock, khóa trước thì join bị từ chối; join trước thì phiên được lưu trước khi khóa. `RateLimitHttpTest` kiểm tra endpoint này bị từ chối 429 trước service. Đây chưa phải kiểm thử cạnh tranh trên MySQL thật.

Frontend join-lock: test API kiểm tra PATCH và body joinLocked; test hook kiểm tra tải/reconnect, chờ ACK, chặn request lặp, giữ trạng thái khi lỗi, từ chối guest và bỏ qua ACK của phòng trước sau điều hướng. Test giao diện kiểm tra nút Host, nhãn khóa/mở, trạng thái chờ và ẩn khi guest/phòng đóng/hết hạn. Các test này giả lập API/STOMP, chưa xác minh luồng nhiều trình duyệt với backend thật.

`RevokedSessionAuthorizationTest` dùng H2 với session lưu thật: sau khi đặt revokedAt, truy vấn lịch sử vẫn tìm thấy session nhưng truy vấn xác thực không trả về. Kiểm tra từ chối reconnect, tạo/vote poll, tạo/spin wheel, tạo/xác nhận decision và không phát broker event. Kiểm tra token phòng khác không reconnect được, token còn hiệu lực reconnect bình thường. Bổ sung kick đúng quyền, không kick Host, retry không đổi revokedAt, giữ lịch sử nhưng giải phóng capacity/loại khỏi danh sách, SessionCacheService xác thực qua SQL không đọc Redis và hai thứ tự kick/reconnect cùng tranh Room lock. Chưa kiểm thử chat xuyên suốt, quyền đọc REST hoặc WebSocket; cạnh tranh SQL ở đây dùng H2. V5 đã được áp dụng riêng qua Flyway trên MySQL local, xác minh cột nullable và giữ nguyên 36 phòng/43 phiên.

Frontend kick: kiểm tra API POST đúng phòng/guestId, không xóa thành viên trước ACK, chặn request lặp, bỏ qua ACK sau điều hướng, giữ danh sách khi lỗi, từ chối guest/kick Host/target không thuộc danh sách. Snapshot phòng đến trễ không thêm lại thành viên đã kick thành công trong cùng phiên hook. Test view kiểm tra nút dành cho Host và trạng thái chờ. Chưa kiểm thử nhiều trình duyệt với backend thật.

`RoomReadAuthorizationTest` chạy 36 trường hợp MockMvc trên đủ 6 GET với RoomAccessImpl thật và repository giả lập: thiếu/sai/token phòng khác/token thu hồi trả 403 trước service đọc; phiên hợp lệ được đọc phòng ACTIVE/CLOSED và header được chuyển đúng. Test này kiểm tra HTTP wiring và không thay thế kiểm thử quyền truy cập xuyên suốt trên MySQL. Test frontend bổ sung chờ join, token rỗng/sai phòng, GET phòng từ chối không mở WebSocket, xóa dữ liệu và bỏ callback cũ khi mất session. Không thay thế bảo vệ STOMP ở server.

## Kết quả nghiệm thu

Xem [báo cáo nghiệm thu local ngày 28/10/2026](reports/2026-10-28-local-acceptance.md). Báo cáo tách khỏi hướng dẫn chạy test để tránh nhầm số đo local với bảo đảm production.

## Hồi quy presence khi vừa vào phòng

Test hook tái hiện danh sách online rỗng trước CONNECT và kiểm tra cập nhật ngay sau CONNECT, không chờ poll 10 giây; response cũ không ghi đè kết quả reconnect mới. Kiểm tra API presence lỗi chuyển sang trạng thái chưa xác định, phục hồi sau reconnect và observer refresh khi nhận PRESENCE_CHANGED. Test view kiểm tra chưa biết presence không bị hiển thị như offline.

`RoomPresenceEventsTest` kiểm tra thông báo CONNECTED và thứ tự xóa presence trước thông báo DISCONNECT. Script `scripts/acceptance/run.mjs` đợi receipt SUBSCRIBE của Host rồi xác minh sự kiện presence thật khi Guest CONNECT/ngắt kết nối. Lượt kiểm tra sửa lỗi này: 121 test frontend, 23 test backend liên quan, frontend build/lint đạt (7 cảnh báo cũ) và script stack local thật đạt. Không thay schema database.

`LocalConfigurationImportTest` kiểm tra Spring ConfigData thực sự nạp file `.properties.local` với extension hint `[.properties]`, từ working directory backend và root repository. Test dùng URL/credentials giả trong thư mục tạm, không mở database. Hai trường hợp đã qua; thiếu hint tái hiện việc không nạp được datasource URL.

`DevelopmentCorsTest` tái hiện HTTP 403 / Invalid CORS request khi frontend dev dùng cổng 4000. Kiểm tra origin localhost:4000, 127.0.0.1:4000 và localhost:5173 đi qua CorsFilter; production override vẫn từ chối origin dev và origin lạ. Tổng 5 test CORS cùng 2 test local config import đã qua sau sửa.

## Kiểm thử BranchChat bản cơ bản

- `BranchChatServiceTest`: đúng phòng/root, chặn nhánh lồng, trích dẫn chéo luồng, giới hạn văn bản, retry cùng payload và conflict khác payload, phòng đóng/hết hạn, count theo batch và cursor 100 tin.
- `BranchChatMongoTest`: chạy khi có `EVENTCHAT_BRANCH_MONGO_URI`, luôn dùng database `branch_chat_test_<uuid>` mới. Xác minh Mongo thật: tin cũ thiếu threadRootId vẫn ở main, branch không lọt vào main, thứ tự/cursor và aggregation không lẫn room/root, index có tồn tại. Chỉ trỏ biến này vào Mongo thử nghiệm riêng.
- `useBranchChat.test.tsx`, `ThreadDrawer.test.tsx` và test hook phòng: retry dùng lại mã, HTTP/realtime trùng một tin, response nhánh cũ bị bỏ qua, không mất nội dung gửi lỗi, read-only, badge và tách Trả lời/Thảo luận nhánh.
- Đã kiểm tra trực quan Drawer bằng dữ liệu mẫu trên trình duyệt desktop và viewport 390 px; gửi phản hồi, count và bố cục ô nhập hoạt động. Ảnh nằm dưới artifacts/branch-chat-desktop.png và artifacts/branch-chat-mobile.png.
- Các kiểm thử trên chưa thay thế kiểm tra hai người trên stack triển khai thật hoặc benchmark production.

UI nhánh được kiểm tra bổ sung: tin gốc nằm ngoài vùng cuộn phản hồi, panel desktop không khóa chat chính, badge chỉ đúng tin đang mở, Escape đóng panel, phản hồi mới không kéo người đọc khỏi tin cũ, và draft A/B được giữ riêng rồi xóa sau ACK. Đã xem trên trình duyệt với dữ liệu mẫu ở 1280 px và 390 px; ảnh ở artifacts/branch-chat-ui-desktop.png và artifacts/branch-chat-ui-mobile.png.

Danh sách nhánh: `useThreadDirectory.test.tsx` kiểm tra tải khi mở, cursor/dedup, retry lỗi, bỏ response khi đóng/đổi phòng, gom refresh realtime và giữ các trang cũ. Kiểm tra tích hợp điều hướng danh sách ↔ nhánh giữ draft; UI mở root ngoài main ở panel desktop. Mongo thật kiểm tra root ObjectId nằm ngoài 50 tin gần nhất, cách ly phòng, thống kê và lọc cursor sau group (không lặp root từ phản hồi cũ). Hai endpoint đọc nhánh tham gia ma trận session thiếu/sai/khác phòng/bị thu hồi và phòng đóng trong `RoomReadAuthorizationTest`.

Đã xem danh sách ở 1280×850 và 390×844 với fixture tạm (đã xóa), mở lại root ngoài main và giữ draft qua điều hướng. Ảnh: `artifacts/branch-directory-desktop.png`, `artifacts/branch-directory-mobile.png`. Đây là QA UI với dữ liệu mẫu; kiểm thử lưu trữ dùng Mongo thử nghiệm riêng.
