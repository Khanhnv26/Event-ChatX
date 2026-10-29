# Tự làm upload — Chặng 2A: entity và repository

Đối chiếu V7 đã migrate trên MySQL local ngày 2026-10-28. Bài này để bạn tự viết; không tự động chép các class vào source backend.

## Mục tiêu

Map đủ ba bảng mới và tạo repository để service có thể tìm attachment đúng phòng, tìm request upload đã tồn tại và khóa quota trong transaction. Chưa viết controller hoặc gọi StorageService trong chặng này.

## Trình tự thực hiện

1. Tạo package com.eventchat.modules.attachment với enums, entity, repository.
2. Viết hai enum trước, ba entity tiếp theo, cuối cùng ba repository. Mỗi public type là một file riêng.
3. Attachment và AttachmentDeleteTask kế thừa BaseEntity hiện có. Không khai báo lại id/createdAt/updatedAt trong hai class này.
4. RoomAttachmentQuota KHÔNG kế thừa BaseEntity: bảng dùng room_id làm khóa chính, không có id tự tăng hoặc created_at. Đây là điểm dễ map nhầm nhất.
5. Không sửa V7 đã migrate. Mapping Java phải khớp schema. Nếu sau này đổi schema, tạo migration kế tiếp.

## AttachmentState.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/enums/AttachmentState.java`

```java
package com.eventchat.modules.attachment.enums;

public enum AttachmentState {
    RESERVED, UPLOADING, PROCESSING, READY, LINKING, LINKED,
    REJECTED, EXPIRED, DELETING
}
```

## AttachmentDeleteState.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/enums/AttachmentDeleteState.java`

```java
package com.eventchat.modules.attachment.enums;

public enum AttachmentDeleteState {
    PENDING, PROCESSING, DONE, FAILED
}
```

## Attachment.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/entity/Attachment.java`

id từ BaseEntity là ID số nội bộ; publicId là UUID đưa ra API. room dùng quan hệ LAZY như convention entity hiện tại. uploaderSessionId là ID lịch sử, không tự lấy từ body client. actualSizeBytes/widthPx/heightPx dùng kiểu boxed vì chưa có giá trị lúc tạo intent. @JdbcTypeCode giữ CHAR và VARCHAR khớp V7, bao gồm state lưu chuỗi.

```java
package com.eventchat.modules.attachment.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.room.entity.Room;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "attachments", uniqueConstraints = {
    @UniqueConstraint(name = "uk_attachment_public_id", columnNames = "public_id"),
    @UniqueConstraint(name = "uk_attachment_client_upload",
        columnNames = {"room_id", "uploader_session_id", "client_upload_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attachment extends BaseEntity {
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", length = 36, nullable = false)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "uploader_session_id", nullable = false)
    private Long uploaderSessionId;

    @Column(name = "client_upload_id", length = 64, nullable = false)
    private String clientUploadId;

    @Column(name = "original_filename", length = 255, nullable = false)
    private String originalFilename;

    @Column(name = "declared_content_type", length = 127, nullable = false)
    private String declaredContentType;

    @Column(name = "detected_content_type", length = 127)
    private String detectedContentType;

    @Column(name = "expected_size_bytes", nullable = false)
    private long expectedSizeBytes;

    @Column(name = "actual_size_bytes")
    private Long actualSizeBytes;

    @Column(name = "reserved_bytes", nullable = false)
    private long reservedBytes;

    @Column(name = "charged_bytes", nullable = false)
    private long chargedBytes;

    @Column(name = "storage_key", length = 80)
    private String storageKey;

    @Column(name = "thumbnail_key", length = 80)
    private String thumbnailKey;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(name = "width_px")
    private Integer widthPx;

    @Column(name = "height_px")
    private Integer heightPx;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "state", length = 32, nullable = false)
    @Builder.Default
    private AttachmentState state = AttachmentState.RESERVED;

    @Column(name = "bound_client_message_id", length = 64)
    private String boundClientMessageId;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "upload_expires_at", nullable = false)
    private Instant uploadExpiresAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
```

## RoomAttachmentQuota.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/entity/RoomAttachmentQuota.java`

Một phòng có một dòng quota. reservedBytes là phần giữ chỗ cho upload đang xử lý; storedBytes là phần đã lưu. Tránh cộng hai lần cùng một tệp khi chuyển trạng thái. Service sẽ dùng khóa để hai request đồng thời không cùng tiêu phần dung lượng cuối.

```java
package com.eventchat.modules.attachment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;

@Entity
@Table(name = "room_attachment_quotas")
@Getter
@Setter
@NoArgsConstructor
public class RoomAttachmentQuota {
    @Id
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "reserved_bytes", nullable = false)
    private long reservedBytes;

    @Column(name = "stored_bytes", nullable = false)
    private long storedBytes;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

## AttachmentDeleteTask.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/entity/AttachmentDeleteTask.java`

Không thêm quan hệ/FK tới Room: công việc xóa phải còn lại sau khi metadata/phòng bị dọn. Worker và lịch retry làm ở chặng cleanup.

```java
package com.eventchat.modules.attachment.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.attachment.enums.AttachmentDeleteState;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "attachment_delete_tasks", uniqueConstraints =
    @UniqueConstraint(name = "uk_attachment_delete_key", columnNames = "storage_key"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttachmentDeleteTask extends BaseEntity {
    @Column(name = "storage_key", length = 80, nullable = false)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "state", length = 32, nullable = false)
    @Builder.Default
    private AttachmentDeleteState state = AttachmentDeleteState.PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at", nullable = false)
    @Builder.Default
    private Instant nextAttemptAt = Instant.now();

    @Column(name = "last_error_code", length = 64)
    private String lastErrorCode;
}
```

## AttachmentRepository.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/repository/AttachmentRepository.java`

Các method phục vụ request đều có roomId. findByPublicId đơn độc không đủ để kiểm tra quyền phòng. Dấu gạch dưới trong Room_Id chỉ rõ đường dẫn room.id cho Spring Data.

```java
package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.Attachment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    Optional<Attachment> findByRoom_IdAndPublicId(Long roomId, String publicId);

    Optional<Attachment> findByRoom_IdAndUploaderSessionIdAndClientUploadId(
            Long roomId, Long uploaderSessionId, String clientUploadId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attachment a where a.room.id = :roomId and a.publicId = :publicId")
    Optional<Attachment> findForUpdate(
            @Param("roomId") Long roomId,
            @Param("publicId") String publicId);
}
```

## RoomAttachmentQuotaRepository.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/repository/RoomAttachmentQuotaRepository.java`

```java
package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.RoomAttachmentQuota;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface RoomAttachmentQuotaRepository
        extends JpaRepository<RoomAttachmentQuota, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from RoomAttachmentQuota q where q.roomId = :roomId")
    Optional<RoomAttachmentQuota> findForUpdate(@Param("roomId") Long roomId);
}
```

## AttachmentDeleteTaskRepository.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/repository/AttachmentDeleteTaskRepository.java`

```java
package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.AttachmentDeleteTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AttachmentDeleteTaskRepository
        extends JpaRepository<AttachmentDeleteTask, Long> {
    Optional<AttachmentDeleteTask> findByStorageKey(String storageKey);
}
```

## Khi nào dùng khóa

Các method @Lock phải chạy trong service @Transactional. Chặng tạo intent sẽ giữ thứ tự khóa: room → kiểm tra session → quota → attachment nếu có. Không stream file, gọi scanner hoặc xử lý ảnh trong transaction đang giữ khóa.

Khi quota chưa có dòng, service giữ khóa Room trước rồi mới tạo RoomAttachmentQuota. Khóa một truy vấn quota không tìm thấy dòng không phải là giải pháp đầy đủ cho race tạo dòng đầu tiên.

Retry intent tìm theo roomId + uploaderSessionId + clientUploadId và đối chiếu payload. Đây là lý do repository có method tương ứng và V7 có unique constraint. Không gọi save trước rồi mới kiểm tra quota.

## Tự kiểm tra

- Không có @Service/@RequiredArgsConstructor trong entity hoặc repository.
- Repository là interface extends JpaRepository; không tự viết class implement.
- Enum gắn @Enumerated(EnumType.STRING), không lưu ordinal.
- expiresAt và uploadExpiresAt là Instant; chưa dùng LocalDateTime để giữ cùng convention dự án.
- Chưa trả trực tiếp entity qua REST: DTO sẽ làm ở chặng 2B để không lộ storageKey/uploaderSessionId và tránh serialize quan hệ LAZY.
- Chưa chỉnh SendMessageRequest hay frontend; attachment chưa có API ghi nên schema hiện tại vẫn rỗng.

## Compile code bạn viết

Trong D:/event_chat/backend:

```powershell
mvn -DskipTests compile
```

Nếu máy chưa có mvn trong PATH, dùng Maven được IntelliJ cấu hình như bài 1. Chỉ compile không chứng minh JPA mapping/query đúng; khi bạn gửi check, trợ lý sẽ chạy kiểm tra mapping/repository tương ứng.

Sau chặng này, làm 2B: AttachmentProperties (giới hạn), DTO request/response, service tạo intent và quota, endpoint POST /rooms/{slug}/attachments, mapping lỗi và token bucket upload. Quyền session/room lấy từ header và server; client không tự chọn uploaderSessionId.

## Kiểm chứng mã mẫu

Mã trong bài đã compile trên Java 21 / Spring Boot 3.3.4 và qua 2 test JPA trên H2 riêng trong artifacts/upload-entity-lesson-check. Đã kiểm tra persist cả ba entity, giá trị mặc định, query theo phòng/uploader/clientUploadId, query có khóa trong transaction và kiểu CHAR/VARCHAR. Đây không phải kiểm thử race quota trên MySQL hoặc API; hai phần đó thuộc chặng sau. Database local đã migrate V7 không bị ghi thêm dữ liệu trong lần kiểm tra bài này.

