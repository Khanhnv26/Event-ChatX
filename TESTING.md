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

Kiểm thử service dùng JUnit và Mockito. `PollConcurrencyTest` dùng database H2 riêng trong bộ nhớ, repository JPA và transaction thật để kiểm tra 8 yêu cầu bỏ phiếu đồng thời. Các kiểm thử không kết nối hay thay đổi database của ứng dụng.

`RoomExpiryContractTest` chạy controller, validation, JSON binding và service tạo phòng với repository giả lập để kiểm tra `ttlMinutes`, tương thích `ttlHours`, mặc định 24 giờ và lỗi 400. Contract được ghi ở `backend/API.md`. Các kiểm thử expiry bổ sung xác minh phòng vẫn mang trạng thái ACTIVE nhưng đã quá `expiresAt` phải từ chối join/chat/vote/spin, không chờ lịch job.

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
