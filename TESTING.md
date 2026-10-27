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

## Phạm vi xác minh

Các kiểm thử frontend giả lập REST/STOMP. Kiểm thử H2 xác minh lưu poll và xử lý cạnh tranh trong môi trường kiểm thử; chưa thay thế việc chạy nhiều trình duyệt cùng backend, MySQL, MongoDB, Redis và RabbitMQ thật. Cần chạy thêm môi trường đầy đủ để xác minh luồng realtime xuyên suốt.
