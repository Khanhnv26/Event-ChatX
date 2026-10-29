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
