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

## Backend

Chạy trong thư mục `backend` bằng Java 21:

```powershell
mvn test
```

Kiểm thử service dùng JUnit và Mockito. `PollConcurrencyTest` dùng database H2 riêng trong bộ nhớ, repository JPA và transaction thật để kiểm tra 8 yêu cầu bỏ phiếu đồng thời. Các kiểm thử không kết nối hay thay đổi database của ứng dụng.

## Phạm vi xác minh

Các kiểm thử frontend giả lập REST/STOMP. Kiểm thử H2 xác minh lưu poll và xử lý cạnh tranh trong môi trường kiểm thử; chưa thay thế việc chạy nhiều trình duyệt cùng backend, MySQL, MongoDB, Redis và RabbitMQ thật. Cần chạy thêm môi trường đầy đủ để xác minh luồng realtime xuyên suốt.
