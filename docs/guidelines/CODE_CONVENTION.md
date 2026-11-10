# EventChat Code Conventions & Engineering Standards

Tài liệu này định nghĩa toàn bộ quy chuẩn lập trình, kiến trúc hệ thống, quy trình Git và tiêu chuẩn an toàn cho dự án **EventChat**. Mọi lập trình viên tham gia phát triển dự án bắt buộc phải tuân thủ các quy tắc này.

---

## Mục lục

1. [Nguyên tắc Thiết kế & Kiến trúc Tổng thể](#1-nguyên-tắc-thiết-kế--kiến-trúc-tổng-thể)
2. [Quy chuẩn Backend (Java 21 / Spring Boot 3.3)](#2-quy-chuẩn-backend-java-21--spring-boot-33)
   - [Phân tầng Package & Ranh giới Module](#phân-tầng-package--ranh-giới-module)
   - [DTO & Jakarta Bean Validation](#dto--jakarta-bean-validation)
   - [Chiến lược Đa Cơ sở Dữ liệu (Polyglot DB)](#chiến-lược-đa-cơ-sở-dữ-liệu-polyglot-db)
   - [Kiểm soát Đồng thời, Giao dịch & Khóa (Concurrency & Locking)](#kiểm-soát-đồng-thời-giao-dịch--khóa-concurrency--locking)
   - [Bảo mật & Quản lý Token](#bảo-mật--quản-lý-token)
   - [Chuẩn hóa REST API & Xử lý Ngoại lệ](#chuẩn-hóa-rest-api--xử-lý-ngoại-lệ)
   - [Quy chuẩn Logging](#quy-chuẩn-logging)
3. [Quy chuẩn Frontend (React 19 / TypeScript 5.6 / Tailwind CSS v4)](#3-quy-chuẩn-frontend-react-19--typescript-56--tailwind-css-v4)
   - [Cấu trúc Thư mục & Phân tách Trách nhiệm](#cấu-trúc-thư-mục--phân-tách-trách-nhiệm)
   - [TypeScript Strict Typing](#typescript-strict-typing)
   - [Quy tắc React 19 & Custom Hooks](#quy-tắc-react-19--custom-hooks)
   - [Hệ thống Design Tokens & Styling](#hệ-thống-design-tokens--styling)
   - [Xử lý Trạng thái Realtime & Optimistic UI](#xử-lý-trạng-thái-realtime--optimistic-ui)
   - [Tiêu chuẩn Phản hồi Lỗi & Trải nghiệm Người dùng (UX/A11y)](#tiêu-chuẩn-phản-hồi-lỗi--trải-nghiệm-người-dùng-uxa11y)
4. [Quy chuẩn Git, Commit & CI/CD](#4-quy-chuẩn-git-commit--cicd)
   - [Chiến lược Nhánh (Branching Model)](#chiến-lược-nhánh-branching-model)
   - [Quy ước Commit (Conventional Commits)](#quy-ước-commit-conventional-commits)
   - [Tiêu chuẩn Pull Request & Code Review](#tiêu-chuẩn-pull-request--code-review)
   - [Cổng Kiểm soát Tự động CI (CI Gates)](#cổng-kiểm-soát-tự-động-ci-ci-gates)

---

## 1. Nguyên tắc Thiết kế & Kiến trúc Tổng thể

* **Modular in Code, Monolith in Deployment:** Hệ thống được tổ chức thành các domain module độc lập (`room`, `chat`, `decision`, `interaction.poll`, `interaction.wheel`, `attachment`, `export`), đóng gói chạy trên một runtime Spring Boot duy nhất.
* **Không phụ thuộc vòng (No Circular Dependencies):** Các module chỉ giao tiếp qua Service Interface công khai hoặc Spring Application Events nội bộ. Tuyệt đối không inject chéo Repository hoặc Entity giữa các module.
* **Fail-Closed & Room-Scoped:** Mọi tài nguyên, truy vấn và quyền hạn đều gắn liền với ngữ cảnh phòng (`roomId` / `slug`). Nếu thiếu xác thực hoặc phòng không ở trạng thái hợp lệ (`ACTIVE`), hệ thống lập tức từ chối thao tác.
* **Idempotency & Reconnect Recovery:** Tất cả thao tác ghi quan trọng (gửi tin nhắn, vote poll, quay số wheel, đề xuất quyết định) phải có cơ chế chống gửi trùng (`clientMessageId`, idempotency key) và cho phép client tải bù dữ liệu theo `sequence` sau khi mất mạng.

---

## 2. Quy chuẩn Backend (Java 21 / Spring Boot 3.3)

### Phân tầng Package & Ranh giới Module

Cấu trúc mỗi module nghiệp vụ tuân thủ mô hình 4 tầng nghiêm ngặt:

```text
com.eventchat.modules.<module_name>/
├── controller/          # REST & WebSocket Endpoints (Chỉ nhận DTO và trả về ResponseEntity)
├── dto/                 # Data Transfer Objects
│   ├── request/         # Request payload kèm Bean Validation
│   └── response/        # Response payload trả về cho client
├── entity/              # JPA Entities (MySQL) hoặc Document Entities (MongoDB)
├── enums/               # Trạng thái, loại dữ liệu thuộc domain
├── repository/          # Spring Data JPA / Mongo Repository interfaces
└── service/             # Public Service Interfaces
    └── impl/            # Business Logic Implementation & Transaction Management
```

> [!IMPORTANT]
> **Quy tắc phân tầng:** Controller $\to$ Service Interface $\to$ ServiceImpl $\to$ Repository.
> Controller tuyệt đối không gọi trực tiếp Repository và không chứa logic nghiệp vụ.

### DTO & Jakarta Bean Validation

1. **Ranh giới DTO bất khả xâm phạm:** Không bao giờ trả về Entity trực tiếp ở Controller. Luôn ánh xạ qua `*Response` DTO để tránh lộ cấu trúc cơ sở dữ liệu và ngăn ngừa lỗi lazy loading.
2. **Bean Validation bắt buộc:** Mọi trường đầu vào trong `*Request` DTO phải được validate chặt chẽ với thông báo lỗi tiếng Việt thân thiện:

```java
public class SendMessageRequest {
    @NotBlank(message = "Không thấy client ID của tin nhắn")
    @Length(max = 64, message = "Client ID của tin nhắn không được vượt quá 64 ký tự")
    private String clientMessageId;

    @Length(max = 2048, message = "Nội dung tin nhắn không được vượt quá 2048 ký tự")
    private String body;

    private String replyToId;

    @Size(max = 4, message = "Tối đa 4 tệp mỗi tin nhắn")
    private List<@NotBlank @Pattern(regexp = "^[0-9a-f-]{36}$") String> attachmentIds;

    @AssertTrue(message = "Tin nhắn phải có nội dung hoặc tệp đính kèm")
    public boolean isContentPresent() {
        return (body != null && !body.isBlank()) || (attachmentIds != null && !attachmentIds.isEmpty());
    }
}
```

### Chiến lược Đa Cơ sở Dữ liệu (Polyglot DB)

* **MySQL (Dữ liệu quan hệ, giao dịch ACID):**
  - Quản lý các bảng: `rooms`, `room_sessions`, `polls`, `poll_options`, `poll_votes`, `wheels`, `wheel_spins`, `decisions`, `attachments`.
  - Mọi thay đổi schema bắt buộc viết script Flyway migration dạng bất biến (`V1__...`, `V2__...`, `V10__...`). Tuyệt đối không chỉnh sửa script đã commit.
  - Tên bảng: số nhiều, `snake_case` (ví dụ: `room_sessions`). Khóa ngoại có hậu tố `_id`.
* **MongoDB (Lịch sử Chat Append-Only):**
  - Collection `messages` lưu trữ tin nhắn chat, reply-to, attachments và thread responses.
  - Bắt buộc có Compound Index tối ưu theo phòng: `{'roomId': 1, 'sequence': 1}` và `{'roomId': 1, 'clientMessageId': 1}`.
  - Tự động xóa theo TTL index (`ttl_expires_at`).
* **Redis (Bộ nhớ đệm & Đồng bộ tức thời):**
  - Quản lý Rate Limiting (Token Bucket), Heartbeat (Presence), Sequence Generation và Session Cache.
  - Thao tác trừ token và kiểm tra rate limit bắt buộc dùng **Lua Script** nguyên tử. Không thực hiện logic kiểm tra rồi mới trừ token qua nhiều lệnh Redis rời rạc.

### Kiểm soát Đồng thời, Giao dịch & Khóa (Concurrency & Locking)

1. **Thứ tự lấy khóa (Lock Ordering):** Khi cập nhật trạng thái phòng hoặc các công cụ sống (Poll, Wheel, Decision), phải lấy khóa ghi dòng `Room` trước, sau đó mới đến dòng của công cụ tương ứng. Quy tắc này loại bỏ hoàn toàn khả năng xảy ra Deadlock.
2. **Kiểm tra trạng thái phòng:** Mọi thao tác ghi phải xác thực trạng thái phòng bằng `requireWritable(room)`:
   ```java
   if (room.getStatus() != RoomStatus.ACTIVE || room.getExpiresAt().isBefore(Instant.now())) {
       throw new IllegalStateException("Phòng đã đóng hoặc hết hạn, không thể thực hiện thao tác");
   }
   ```
3. **Phát sự kiện sau Commit:** Các bản tin realtime đẩy ra RabbitMQ / STOMP chỉ được phát **sau khi** giao dịch database đã commit thành công.

### Bảo mật & Quản lý Token

* **Băm Capability Token:** Token Host và Guest Session Token tuyệt đối **không lưu dạng plain-text**. Trên MySQL và Redis chỉ lưu giá trị băm `SHA-256` (`TokenUtil.sha256(rawToken)`).
* **Tuyệt đối không log Secret:** Cấm ghi giá trị token, mật khẩu, nội dung private chat vào file log hoặc console.
* **CORS & Proxy Security:** Chặn truy cập công khai vào các endpoint nội bộ (`/internal/*`, `/actuator/*`).

### Chuẩn hóa REST API & Xử lý Ngoại lệ

* **Mã trạng thái HTTP (Status Codes):**
  - `200 OK`: Truy vấn hoặc cập nhật thành công có trả về dữ liệu.
  - `201 Created`: Tạo mới tài nguyên thành công (kèm URI hoặc đối tượng vừa tạo).
  - `204 No Content`: Thao tác thành công không cần trả về body.
  - `400 Bad Request`: Dữ liệu đầu vào sai định dạng hoặc vi phạm ràng buộc nghiệp vụ.
  - `401 Unauthorized`: Thiếu token hoặc token không hợp lệ.
  - `403 Forbidden`: Token hợp lệ nhưng không đủ quyền (ví dụ: Guest gọi API Host-only).
  - `404 Not Found`: Không tìm thấy phòng hoặc tài nguyên yêu cầu.
  - `409 Conflict`: Xung đột phiên, phòng đã đầy (`capacity`), hoặc trùng mã gửi tin.
  - `429 Too Many Requests`: Vượt ngưỡng rate limit. **Bắt buộc đính kèm header `Retry-After: <giây>`**.
  - `503 Service Unavailable`: Hạ tầng phụ thuộc bị gián đoạn (ví dụ: Redis không phản hồi).

### Quy chuẩn Logging

Sử dụng SLF4J với Correlation ID:
```java
log.info("Message sent successfully. roomId={}, sequence={}, authorSessionId={}",
         roomId, message.getSequence(), session.getId());
```
* **Nên log:** `roomId`, `slug`, `sessionId`, `sequence`, mã lỗi, thời gian phản hồi.
* **Cấm log:** Raw Bearer Tokens, Session Hashes, Nội dung tin nhắn chat thô của người dùng.

---

## 3. Quy chuẩn Frontend (React 19 / TypeScript 5.6 / Tailwind CSS v4)

### Cấu trúc Thư mục & Phân tách Trách nhiệm

```text
frontend/src/
├── components/          # React Components chia theo module
│   ├── attachments/     # Upload tệp, xem trước ảnh
│   ├── common/          # ModalPortal, MotionPresence, Preloader
│   ├── landing/         # Giao diện trang chủ và tạo phòng
│   ├── layout/          # Header, Footer, TopBanner
│   ├── room/            # Workspace chat, Living Tools, ThreadDrawer
│   └── ui/              # Component nguyên tử (Toast, ConfirmModal, Buttons)
├── hooks/               # Custom hooks nghiệp vụ (useEventChat, useBranchChat)
├── routes/              # Trang điều hướng chính (LandingPage, RoomPage)
├── services/            # Client HTTP (Axios) và WebSocket (STOMP Client)
├── stores/              # Quản lý Global State nhẹ (Zustand: toastStore)
└── types/               # Kiểu dữ liệu TypeScript khớp với Backend
```

### TypeScript Strict Typing

* **Tuyệt đối không dùng `any`:** Bật `noImplicitAny: true` trong cấu hình TypeScript. Dùng `unknown` kèm Type Narrowing nếu kiểu chưa xác định trước.
* **Đồng bộ hóa Types:** Mọi type phản ánh DTO từ backend phải nằm tại [`frontend/src/types/backend.types.ts`](file:///d:/event_chat/frontend/src/types/backend.types.ts).
* **Interface Props rõ ràng:**
  ```tsx
  interface ThreadDrawerProps {
    isOpen: boolean;
    rootMessage: MessageResponse | null;
    onClose: () => void;
    onReplySent?: (message: MessageResponse) => void;
  }
  ```

### Quy tắc React 19 & Custom Hooks

1. **Tách biệt Logic và Giao diện:** Logic kết nối socket, reconnect, phân trang, optimistic queue phải nằm trong custom hooks (`useEventChat`, `useBranchChat`). Component view chỉ nhận dữ liệu và callbacks để render.
2. **Tránh gọi setState đồng bộ trong Effect:** Không gọi `setState` trực tiếp bên trong `useEffect` khi có thể tính toán trực tiếp trong lúc render hoặc bắt sự kiện từ handler (tuân thủ cảnh báo React 19 / React Compiler).
3. **Tránh rò rỉ bộ nhớ (Memory Leaks):** Mọi STOMP subscription hoặc timer (`setTimeout`, `setInterval`) trong `useEffect` đều bắt buộc phải có cleanup function:
   ```tsx
   useEffect(() => {
     const sub = stompClient.subscribe(topic, handleMessage);
     return () => {
       sub.unsubscribe();
     };
   }, [topic]);
   ```

### Hệ thống Design Tokens & Styling

* **Tuân thủ Design Tokens:** Sử dụng các CSS variables đã chuẩn hóa trong [`docs/design/MASTER.md`](file:///d:/event_chat/docs/design/MASTER.md):
  - Primary Color: `var(--color-primary)` (`#6366F1`)
  - Accent / CTA: `var(--color-accent)` (`#059669`)
  - Typography: Tiêu đề dùng font `Outfit`, nội dung dùng font `Work Sans`.
* **Kết hợp Utility Class:** Sử dụng hàm tiện ích `cn(...)` (kết hợp `clsx` và `tailwind-merge`) khi ghép nối Tailwind classes động.

### Xử lý Trạng thái Realtime & Optimistic UI

1. **Hiển thị tức thì (Optimistic Updates):** Khi người dùng gửi tin nhắn, lập tức thêm tin vào danh sách hiển thị cục bộ với cờ `isPending: true` và `clientMessageId`. Khi server phản hồi ACK hoặc qua socket, cập nhật lại trạng thái thành `isPending: false` dựa vào `clientMessageId`.
2. **Khôi phục sau ngắt kết nối (Reconnect Recovery):** Khi socket bị đứt và kết nối lại, hook phải tự động gọi API `GET /api/rooms/{slug}/messages?afterSequence={maxSequence}` để kéo bù các tin nhắn bị thiếu trong thời gian mất mạng.

### Tiêu chuẩn Phản hồi Lỗi & Trải nghiệm Người dùng (UX/A11y)

* **Xử lý lỗi qua Toast:** Không bao giờ dùng `window.alert()` hoặc nuốt lỗi (silent catch). Mọi lỗi API trả về phải gọi `toastStore.getState().showToast({ type: 'error', message })`.
* **Keyboard Navigation & Modal Traps:**
  - Mọi Modal và Drawer phải bẫy focus bàn phím, cho phép đóng nhanh bằng phím `Escape`.
  - Nút bấm và input phải có nhãn rõ ràng (`aria-label`) cho các công nghệ hỗ trợ tiếp cận (Screen Readers).

---

## 4. Quy chuẩn Git, Commit & CI/CD

### Chiến lược Nhánh (Branching Model)

* `main`: Nhánh production. Code trên nhánh này luôn ở trạng thái sẵn sàng deploy.
* `feature/<tên-tính-năng>`: Nhánh phát triển tính năng mới (ví dụ: `feature/branch-chat`, `feature/living-tools`).
* `fix/<tên-lỗi>`: Nhánh sửa lỗi nóng.

### Quy ước Commit (Conventional Commits)

Format chuẩn: `<type>(<scope>): <mô tả ngắn bằng tiếng Anh hoặc tiếng Việt>`

* **Types:**
  - `feat`: Tính năng mới cho người dùng.
  - `fix`: Sửa lỗi hệ thống.
  - `refactor`: Tái cấu trúc mã nguồn không làm thay đổi hành vi bên ngoài.
  - `test`: Viết thêm hoặc sửa đổi kiểm thử tự động.
  - `docs`: Cập nhật tài liệu, README, OpenAPI.
  - `chore`: Cấu hình build, dependencies, tooling.
* **Scopes:** `room`, `chat`, `decision`, `poll`, `wheel`, `attachment`, `branch`, `ui`, `ratelimit`, `ops`, `ci`.
* **Ví dụ:**
  - `feat(branch): support file attachments in thread messages`
  - `fix(decision): reject vote requests when room is closed`
  - `test(ratelimit): verify redis token bucket refill under concurrent load`

### Tiêu chuẩn Pull Request & Code Review

1. Mọi PR phải có mô tả rõ: **Vấn đề cần giải quyết**, **Các thay đổi chính**, và **Bằng chứng kiểm thử** (kèm screenshot nếu có thay đổi UI).
2. Trước khi tạo PR, lập trình viên bắt buộc chạy kiểm tra cục bộ:
   ```bash
   # Backend
   cd backend && mvn test

   # Frontend
   cd frontend && npm.cmd run test && npm.cmd run lint && npm.cmd run build
   ```

### Cổng Kiểm soát Tự động CI (CI Gates)

Mỗi lần `git push` lên nhánh `main` hoặc tạo Pull Request, GitHub Actions CI sẽ tự động kích hoạt:
1. **Backend Job:** Chạy Java 21 cùng dịch vụ Redis thật trong container (`redis:7-alpine`), thực thi toàn bộ test tích hợp.
2. **Frontend Job:** Chạy Node 24, thực thi `vitest run`, `oxlint` và `vite build`.
3. **Chỉ được merge PR khi cả 2 jobs đều báo XANH (Build Success).**
