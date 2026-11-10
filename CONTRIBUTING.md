# Contributing to EventChat

Cảm ơn bạn đã đóng góp cho dự án EventChat! Để giữ cho mã nguồn luôn sạch, bảo mật và ổn định, tất cả người đóng góp cần tuân thủ các quy tắc dưới đây.

---

## 1. Quy chuẩn Lập trình (Code Conventions)

Dự án áp dụng bộ quy chuẩn kỹ thuật toàn diện được ghi chép chi tiết tại:
👉 **[EventChat Code Conventions & Engineering Standards](docs/guidelines/CODE_CONVENTION.md)**

### Tóm tắt các quy tắc cốt lõi:
- **Kiến trúc Modular Monolith:** `controller` → `service` interface → `service.impl` → `repository`. Không truy vấn chéo repository giữa các module.
- **DTO Boundary:** Dùng DTO cho toàn bộ HTTP boundaries, không bao giờ để lộ Entity ra Controller. Bắt buộc có Bean Validation.
- **Bảo mật Token:** Băm SHA-256 các capability tokens trước khi lưu hoặc so sánh. Tuyệt đối không log raw tokens hoặc chat payload.
- **Khóa & Giao dịch:** Khi ghi dữ liệu thay đổi trạng thái, luôn khóa dòng `Room` trước, sau đó mới đến dòng của công cụ (Poll/Wheel/Decision).
- **Phát sự kiện:** Chỉ broadcast STOMP events ra RabbitMQ **sau khi** giao dịch database đã commit thành công.
- **Flyway Migrations:** Mọi thay đổi bảng MySQL phải viết migration mới và có tính bất biến.
- **UI/UX & Design Tokens:** Tuân thủ hệ màu và typography quy định tại `docs/design/MASTER.md`. Dùng Toast cho lỗi và bẫy focus cho modal.

---

## 2. Quy trình Kiểm tra Cục bộ trước khi Tạo PR

Trước khi commit và gửi Pull Request, bạn bắt buộc phải chạy kiểm tra cục bộ để đảm bảo CI không bị gãy:

### Backend:
```bash
cd backend
mvn test
```

### Frontend:
```bash
cd frontend
npm test
npm run lint
npm run build
```

---

## 3. Quy ước Git Commit

Dự án áp dụng chuẩn **Conventional Commits**:
```text
<type>(<scope>): <mô tả ngắn gọn>
```

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- **Scopes:** `room`, `chat`, `decision`, `poll`, `wheel`, `attachment`, `branch`, `ui`, `ratelimit`, `ops`, `ci`
- **Ví dụ:**
  - `feat(branch): support file attachments in thread messages`
  - `fix(decision): reject vote requests when room is closed`
  - `chore(deps): update react dependencies`

---

## 4. Bảo mật & Dữ liệu nhạy cảm

- **Tuyệt đối không commit** file chứa secrets, mật khẩu, API keys (ví dụ: `.env`, `application-secrets.properties.local`).
- Luôn kiểm tra `git status` trước khi push để đảm bảo không đẩy nhầm dữ liệu thử nghiệm cá nhân lên repository.
