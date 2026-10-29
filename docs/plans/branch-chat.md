# Kế hoạch triển khai BranchChat

Ngày đề xuất: 29/10/2026. Trạng thái: kế hoạch để triển khai, chưa phải tính năng đã nghiệm thu.

Phạm vi triển khai đợt đầu đã được thu gọn theo yêu cầu phù hợp fresher: một nhánh văn bản từ tin gốc, Drawer, đếm phản hồi, tải lại và realtime, xác thực/chống gửi trùng. Các phần danh sách nhánh, giữ nhiều draft/cache, thống kê người tham gia và phân trang UI trong kế hoạch dưới đây tiếp tục là roadmap; không được coi là đã hoàn thành cùng bản cơ bản. Hành vi hiện có được ghi riêng trong `docs/api/README.md`.

Mục tiêu là mở một nhánh từ tin nhắn để thảo luận chủ đề phụ, giữ chat chính dễ theo dõi. BranchChat được ưu tiên trước AI Summary và Room Policy; không thay đổi quyền Poll/Wheel trong đợt này.

## 1. Phạm vi bản đầu

- Mỗi tin nhắn văn bản hoặc tin có tệp ở chat chính có tối đa một nhánh. Tin hệ thống và tin đang gửi/lỗi không mở được nhánh.
- Mọi thành viên có session hợp lệ trong cùng phòng đều được xem nhánh. Được gửi khi phòng ACTIVE và chưa hết hạn.
- Nhánh không phải phòng riêng; không có thành viên hay quyền truy cập riêng.
- Phản hồi mới chỉ nằm trong nhánh. Chat chính chỉ cập nhật số phản hồi, người tham gia và hoạt động của nhánh.
- Bản đầu gửi văn bản trong nhánh; hỗ trợ xem tệp của tin gốc. Gửi tệp trong nhánh là bước tiếp theo sau khi nghiệm thu bản văn bản.
- Trong nhánh vẫn có thể trích dẫn một phản hồi cùng nhánh, nhưng không tạo nhánh lồng nhánh.
- Đóng phòng, hết hạn và kick áp dụng đồng nhất cho chat chính và nhánh.
- Chưa làm: AI tổng hợp nhánh, tự chốt Decision, nhánh riêng tư, đóng riêng một nhánh, chỉnh sửa/xóa tin, thông báo email/push, trạng thái đã đọc đồng bộ nhiều thiết bị.

## 2. Căn cứ từ code hiện tại

- Tin nhắn nằm trong MongoDB collection `messages`; SQL lưu phòng, session và metadata tệp.
- `replyToId` hiện chỉ tạo một trích dẫn trong dòng chat, không đại diện cho nhánh.
- Tin đã có `clientMessageId`, sequence theo phòng, TTL và unique indexes chống gửi trùng.
- Gửi tin dùng REST có xác thực/rate limit; STOMP chỉ dùng để nhận sự kiện.
- Frontend hiện có một danh sách `messages` và một cursor reconnect cho cả phòng. Cần tách trạng thái theo luồng trước khi nhận phản hồi nhánh.
- Bố cục desktop đã có cột phải dành cho thành viên/quản trị; không thêm cột thứ tư.
- Giữ nguyên khóa Room và cách phối hợp SQL/Mongo đang có. Việc tối ưu khóa không nằm trong BranchChat.

## 3. Luồng trải nghiệm

### Chat chính

1. Cạnh “Trả lời” có “Thảo luận nhánh” trên tin đã được server xác nhận.
2. Khi có phản hồi, thay bằng “N phản hồi” và tối đa ba avatar/tên viết tắt; có nhãn truy cập rõ ràng cho bàn phím và screen reader.
3. Nhấn nút mở lại cùng nhánh, không tạo nhánh mới.
4. “Trả lời” giữ nguyên ý nghĩa: gửi tin trích dẫn vào chat chính. “Thảo luận nhánh” đưa người dùng sang một luồng riêng.
5. Mở Drawer không ghi dữ liệu. Nhánh chỉ xuất hiện trong danh sách sau phản hồi đầu tiên được lưu thành công.
6. Có lối vào “Nhánh thảo luận” trong header để tìm nhánh khi tin gốc đã trôi khỏi 50 tin gần nhất.

### Bên trong nhánh

- Header ghi “Nhánh thảo luận”, nút quay lại danh sách/đóng, và trạng thái phòng.
- Ghim tin gốc: người gửi, nội dung và tệp đính kèm; nội dung dài có thể thu gọn.
- Danh sách phản hồi có người gửi, thời gian, trạng thái gửi và chức năng trích dẫn trong cùng nhánh.
- Ô nhập ghi rõ “Nhắn trong nhánh này”; không dùng chung nội dung nháp với ô chat chính.
- Giữ bản nháp riêng theo root ID trong phiên đang mở. Đóng/mở Drawer hoặc đổi nhánh không làm mất bản nháp.
- Gửi lỗi giữ nguyên nội dung và cung cấp thử lại với cùng clientMessageId.
- Có “Tải phản hồi cũ hơn”; chỉ tự cuộn khi đang ở cuối hoặc vừa gửi tin của chính mình.
- Khi đang đọc tin cũ, hiện nút “N phản hồi mới”; không tự kéo người đọc xuống cuối.
- Chỉ đánh dấu “mới” theo trạng thái cục bộ của tab; không mô tả đây là số chưa đọc chính xác trên mọi thiết bị.

### Desktop và điện thoại

- Màn hình rộng: Drawer thay nội dung cột phải, giữ chat chính và cột quyết định. Khi đóng, trả lại panel trước đó.
- Màn hình vừa: Drawer phủ bên phải thay vì ép chat chính quá hẹp. Chốt breakpoint bằng kiểm tra thực tế ở 1024/1280 px.
- Điện thoại: panel toàn màn hình, nút quay lại rõ; vùng nhập không bị bàn phím che.
- Drawer dạng overlay có focus trap, Escape để đóng và trả focus về nút mở. Panel gắn trong bố cục desktop không khóa focus toàn trang.
- Mở nhánh không tự đánh dấu toàn bộ chat chính là đã đọc, không thay đổi vị trí cuộn của chat chính.

## 4. Mô hình dữ liệu đề xuất

Thêm `threadRootId: string | null` vào Message, SendMessageRequest và MessageResponse:

- Tin chat chính: `threadRootId = null` hoặc trường không tồn tại trên dữ liệu cũ.
- Phản hồi nhánh: `threadRootId` bằng Mongo message ID của tin gốc ở chat chính.
- `replyToId` tiếp tục là tham chiếu trích dẫn; không dùng thay cho `threadRootId`.
- Nếu có replyToId, đích trích dẫn phải cùng phòng và cùng luồng. Không nhận root là một phản hồi nhánh hoặc tin hệ thống.
- Dùng root message ID làm định danh nhánh. Chưa tạo bảng SQL hoặc collection thread chỉ để giữ một ID trùng với tin gốc.
- Giữ sequence tăng theo phòng, không bổ sung bộ sinh sequence theo nhánh. Sequence của một luồng có thể có khoảng trống; không diễn giải khoảng trống là mất tin.
- Giữ unique `(roomId, clientMessageId)` và `(roomId, sequence)`; thêm index truy vấn `(roomId, threadRootId, sequence)`.
- Truy vấn chat chính phải bao gồm cả trường null và trường chưa tồn tại, để dữ liệu cũ vẫn hiển thị.
- Thống kê nhánh lấy từ phản hồi đã được công bố: replyCount, participantCount, tối đa ba người tham gia mẫu và lastActivitySequence. Tin gốc không tính là phản hồi.
- Dùng aggregation theo batch cho các root đang hiển thị; tránh gọi count riêng cho từng tin và tránh thêm counter cần đồng bộ chéo SQL/Mongo ở bản đầu.
- Có script tạo index Mongo idempotent và kiểm tra query plan trên stack thử nghiệm. Không dùng Flyway SQL để giả định index Mongo đã tồn tại.

## 5. Hợp đồng REST dự kiến

Tất cả đường dẫn bên dưới có prefix `/api/v1/rooms/{slug}` và kiểm tra session còn hiệu lực thuộc đúng phòng.

### Gửi phản hồi

`POST /messages` giữ endpoint hiện có, thêm `threadRootId` tùy chọn.

Ví dụ body:

```json
{
  "clientMessageId": "<uuid>",
  "body": "Mình đề xuất họp lúc 19 giờ.",
  "threadRootId": "<root-message-id>",
  "replyToId": null
}
```

- Server kiểm tra quyền/phòng, tin gốc, luồng của trích dẫn và trạng thái ghi trước khi lưu/phát sự kiện.
- Client không được truyền roomId, danh tính người gửi hoặc tự quyết định sequence.
- Retry cùng clientMessageId và cùng luồng trả cùng tin, không tạo phản hồi hoặc tăng thống kê lần nữa.
- Dùng lại clientMessageId với threadRootId khác hoặc payload nhánh khác trả conflict; không được âm thầm đổi nơi gửi tin.
- Bản văn bản từ chối attachmentIds trong phản hồi nhánh với lỗi rõ ràng; chat chính vẫn giữ hỗ trợ tệp hiện có.
- Giữ bucket CHAT theo room + session cho cả hai nơi. Chuyển qua nhánh không tạo một quota mới để vượt rate limit.

### Tải nhánh

`GET /threads/{rootMessageId}?beforeSequence=...&limit=50`

- Trả `rootMessage`, `summary`, `items` và `pageInfo`.
- Mặc định lấy tối đa 50 phản hồi gần nhất, trả theo thứ tự cũ đến mới để render.
- beforeSequence tải lịch sử cũ; afterSequence dùng để tải bù. Không nhận cả before và after trong một request; giới hạn limit tối đa 100.
- `pageInfo` có nextCursor/hasMore cho đúng hướng truy vấn; không dùng số trang hoặc giả định sequence liên tiếp.
- Tải tin gốc từ server kể cả khi frontend chưa có tin đó trong bộ nhớ.
- Không tìm thấy hoặc tin gốc không thuộc phòng trả lỗi phù hợp, không đưa nội dung phòng khác vào thông báo lỗi.

### Danh sách và thống kê nhánh

- `GET /threads?beforeActivitySequence=...&limit=20`: các nhánh có phản hồi, sắp xếp hoạt động mới nhất trước. Cursor dựa trên hoạt động, không dùng offset; deduplicate khi merge các trang vì nhánh có thể hoạt động lại trong lúc phân trang.
- `GET /threads/summaries?rootIds=...`: tối đa 50 root IDs; trả thống kê theo batch cho các tin đang hiển thị. Giới hạn số ID và xác thực toàn bộ cùng phòng.
- Route `/threads/summaries` phải được phân biệt với route root ID; ghi rõ schema ID và quy tắc route trong OpenAPI.
- `GET /messages` và truy vấn afterSequence hiện hữu chỉ trả chat chính sau khi có BranchChat. Giữ dạng response cũ để hạn chế thay đổi client.
- Root preview và thống kê chỉ lấy dữ liệu đã công bố, không lộ tin đang chờ liên kết tệp.

## 6. Realtime và tải bù

- Dùng lại `/topic/room.{slug}.messages`; mỗi MessageResponse có threadRootId để client định tuyến.
- Không thêm kết nối WebSocket cho từng nhánh. Phạm vi xem của nhánh bằng phạm vi xem phòng nên có thể dùng chung topic đã xác thực.
- Tin không có root ID vào chat chính; tin có root ID vào cache của nhánh tương ứng. Tuyệt đối không append phản hồi nhánh vào danh sách chat chính.
- Khi nhánh chưa tải, chỉ đánh dấu thống kê cần cập nhật, không giữ lịch sử vô hạn của mọi nhánh trong bộ nhớ.
- Sự kiện nhánh làm invalidation thống kê theo batch, có gộp request; không cộng replyCount mù theo mỗi frame vì retry/reconnect có thể phát trùng.
- Phân biệt cursor đã đồng bộ qua REST với sequence mới nhất vừa nhận realtime. Một frame mới không được đẩy cursor vượt qua khoảng tin chưa tải bù.
- Giữ cursor riêng cho MAIN và từng nhánh đã tải. Frame của nhánh A không được đẩy cursor MAIN hoặc nhánh B.
- Khi reconnect: đăng ký topic trước, giữ/merge sự kiện đến trong lúc tải; tải bù MAIN và các nhánh đã cache theo cursor riêng, phân trang đến hết; refresh danh sách/thống kê để nhận ra nhánh mới.
- Khi mở nhánh chưa cache, tải snapshot mới từ REST thay vì giả định đã nhận đủ realtime trong lúc nhánh đóng.
- Deduplicate theo server message ID/clientMessageId trước khi render; sort theo sequence. Xử lý trường hợp realtime đến trước HTTP ACK.
- Có generation/AbortController để response của nhánh cũ hoặc phòng cũ không ghi đè panel mới.
- Kiểm thử hồi phục của tin gốc có tệp tiếp tục theo cơ chế publication/reconciliation hiện có; không mở rộng cam kết thành transaction phân tán SQL/Mongo.

## 7. Quyền truy cập và vòng đời

- Mỗi thao tác đọc/ghi kiểm tra room/session hiện hành; không chỉ tin việc WebSocket đã CONNECT trước đó.
- Root phải thuộc đúng phòng và đã công bố; cùng root ID không cho phép truy cập từ phòng khác.
- Phiên bị kick không được đọc lại, tải lịch sử hoặc tiếp tục nhận sự kiện; giữ kiểm tra outbound và exact-topic allowlist hiện có.
- Khi phòng CLOSED/EXPIRED: vẫn xem được trong thời hạn lưu trữ nếu session còn quyền, nhưng không tạo phản hồi, không gửi lại bản nháp đang lỗi.
- Thời hạn giữ tin nhánh giống chat chính: expiresAt phòng + 7 ngày. Job xóa theo roomId và TTL phải dọn cả phản hồi nhánh.
- Không thay đổi cơ chế khóa Room, chống spam, attachment authorization hoặc chính sách export của host.

## 8. Tổ chức mã và giai đoạn triển khai

### Giai đoạn 0 Chốt hành vi và thiết kế màn hình — khoảng 0,5 ngày

- Chốt một nhánh cho mỗi tin gốc, phản hồi văn bản, mọi người cùng phòng đều xem được.
- Phác giao diện desktop/mobile, chỗ đặt hai nút Trả lời/Thảo luận nhánh và danh sách nhánh.
- Chốt JSON schemas, cursor semantics, lỗi 400/403/404/409/429 và quyền gửi trước khi sửa code.
- Cập nhật kế hoạch/OpenAPI, ghi rõ BranchChat là phần mở rộng FR-11; không đánh dấu nghiệm thu toàn bộ FR-11 khi chưa có tổng hợp theo nhánh.

Điểm hoàn thành: có ví dụ luồng và API nhất quán; không còn dùng replyToId cho hai ý nghĩa.

### Giai đoạn 1 Dữ liệu và truy vấn — khoảng 0,5–1 ngày

- Bổ sung threadRootId vào entity/DTO Mongo và kiểu TypeScript.
- Thêm query chính/nhánh, phân trang hai hướng và batch aggregation thống kê.
- Thêm script index, fixture dữ liệu cũ thiếu trường, root văn bản và root có tệp.

Điểm hoàn thành: truy vấn MAIN không chứa phản hồi nhánh; truy vấn nhánh chỉ trả đúng root; dữ liệu cũ còn đọc được.

### Giai đoạn 2 API gửi và đọc — khoảng 1 ngày

- Mở rộng ChatService/ChatController; tái sử dụng xác thực, sequence và pipeline gửi hiện có.
- Tách helper kiểm tra luồng/root để luồng MAIN và THREAD không sao chép toàn bộ sendMessage.
- Thêm API đọc nhánh, danh sách và summaries; validate giới hạn đầu vào.
- Kiểm tra scope trong mọi nhánh retry và DuplicateKeyException, không chỉ khi gửi lần đầu.
- Chưa tạo service thread trong SQL hoặc viết lại cơ chế chat.

Điểm hoàn thành: REST tạo/đọc/retry hoạt động; cross-room, cross-thread, CLOSED và revoked đều bị chặn đúng.

### Giai đoạn 3 Client state và realtime — khoảng 0,5–1 ngày

- Thêm `threadApi.ts` và `useBranchChat.ts`; cache theo room + root ID, cursor, draft, loading/error riêng.
- Hook phòng tiếp tục sở hữu một kết nối STOMP; định tuyến sự kiện sang hook nhánh qua adapter nhỏ, không tạo socket singleton thứ hai.
- Sửa cursor reconnect hiện có và thêm đồng bộ theo từng luồng.
- Giới hạn cache, ví dụ 10 nhánh gần nhất; có chính sách giữ draft dù nội dung lịch sử bị loại khỏi cache.

Điểm hoàn thành: mất mạng/mở lại không mất hoặc lặp phản hồi; tin nhánh không làm chat chính tự cuộn.

### Giai đoạn 4 Giao diện — khoảng 1–1,5 ngày

- `ThreadDrawer.tsx`, `ThreadList.tsx`, `ThreadComposer.tsx` và badge phản hồi trên `ChatMessageList`.
- Dùng lại phần bubble hiển thị tin; bổ sung callback phù hợp, không để nút mở nhánh xuất hiện trên phản hồi nhánh.
- Tích hợp với `RoomWorkspaceView`; thay cột phải khi phù hợp, overlay/fullscreen khi thiếu diện tích.
- Hoàn thiện empty/loading/error/retry/read-only, focus, bàn phím, bản nháp và thao tác trở lại chat chính.

Điểm hoàn thành: dùng được bằng chuột, bàn phím và điện thoại; biết rõ mình đang gửi vào đâu.

### Giai đoạn 5 Kiểm thử và nghiệm thu stack thật — khoảng 1–1,5 ngày

- Backend: validation root, same-stream reply, pagination, legacy data, idempotency, rate limit, quyền đọc/ghi và retention.
- Frontend: định tuyến tin, draft tách biệt, cache, stale responses, unread cục bộ, focus và trạng thái read-only.
- Integration: Mongo thật, Redis sequence/rate limit, Rabbit STOMP trên stack dùng dữ liệu thử; không dùng H2/mock để khẳng định behavior Mongo.
- Acceptance script `scripts/acceptance/branch-chat.mjs`, báo cáo có cấu hình và giới hạn rõ ràng.
- Kiểm tra trực quan hai cửa sổ host/guest và mobile ở 360/390 px; chụp bằng chứng dưới artifacts/.
- Đo thử 50 phiên ở tốc độ gửi nằm trong limiter; tách 429 dự kiến khỏi lỗi ngoài dự kiến. Ghi HTTP latency và độ trễ nhận WebSocket riêng, không tuyên bố năng lực production.

Điểm hoàn thành: toàn bộ checklist bên dưới đạt; build/lint và các regression tests liên quan qua; ghi rõ test chưa chạy nếu hạ tầng thiếu.

## 9. Checklist nghiệm thu

- [ ] Host và guest mở cùng tin gốc đều vào cùng nhánh.
- [ ] Mở/đóng nhánh trống không tạo dữ liệu rác.
- [ ] Gửi trong nhánh không xuất hiện như một tin mới ở chat chính.
- [ ] Hai người phản hồi đồng thời không mất tin hoặc tạo hai nhánh cho một root.
- [ ] Retry và realtime-before-ACK chỉ render một phản hồi, không tăng số phản hồi hai lần.
- [ ] Dùng cùng clientMessageId cho hai nhánh khác nhau bị từ chối.
- [ ] Lịch sử >100 phản hồi phân trang đủ, đúng thứ tự, không lặp.
- [ ] Mất kết nối rồi có tin xen kẽ MAIN/A/B vẫn tải bù đủ từng luồng.
- [x] Root nằm ngoài 50 tin gần nhất vẫn mở được từ danh sách nhánh (API riêng, kiểm tra Mongo thật và UI với dữ liệu mẫu).
- [ ] Tin mới không kéo người đang đọc tin cũ; chat chính giữ vị trí cuộn.
- [ ] Đổi nhánh nhanh không hiện dữ liệu của nhánh trước; đổi phòng không lộ dữ liệu phòng cũ.
- [ ] Draft MAIN/A/B được giữ riêng, gửi lỗi không làm mất nội dung.
- [ ] Không tạo nhánh từ SYSTEM, phản hồi nhánh hoặc tin chưa được server xác nhận.
- [ ] Reply chéo phòng/chéo luồng bị chặn ở server.
- [ ] Phòng đóng/hết hạn từ chối gửi; session bị kick mất quyền đọc và nhận dữ liệu.
- [ ] Tệp của root giữ đúng quyền; bản đầu không gửi tệp trong nhánh và giải thích rõ trên UI.
- [ ] Drawer không che ô nhập trên điện thoại; Escape/focus hoạt động đúng loại panel.
- [ ] TTL/retention xóa cả nhánh; dữ liệu cũ thiếu threadRootId còn hiển thị trong chat chính.
- [ ] Poll, Wheel, Decision, export và reply hiện hữu không bị hồi quy.

## 10. Ước lượng và bước tiếp theo

Ước lượng tổng: khoảng 5–7,5 ngày làm việc cho một lập trình viên quen codebase, đã có stack thử nghiệm chạy được. Đây là ước lượng lập kế hoạch, cần hiệu chỉnh sau giai đoạn 0–1; chưa gồm AI, tệp gửi trong nhánh hoặc đồng bộ đã đọc nhiều thiết bị.

Nên triển khai theo ba lát cắt có thể kiểm tra độc lập:

1. API + một nhánh văn bản hoạt động end-to-end.
2. Danh sách/thống kê, lịch sử, reconnect và trải nghiệm desktop/mobile.
3. Quyền/vòng đời, kiểm thử concurrency và nghiệm thu stack thật.

Sau khi bản đầu đạt nghiệm thu, mới cân nhắc gửi tệp trong nhánh, tìm kiếm và chuyển nội dung nhánh thành đề xuất Decision. AI Summary tiếp tục để sau.
