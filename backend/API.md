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

Chạy kiểm thử contract bằng Java 21 trong thư mục `backend`:

```powershell
mvn -Dtest=RoomExpiryContractTest test
```
