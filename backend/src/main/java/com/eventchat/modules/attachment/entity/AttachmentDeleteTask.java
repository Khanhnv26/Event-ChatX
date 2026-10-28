package com.eventchat.modules.attachment.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.attachment.enums.AttachmentDeleteState;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
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

    @Column(name ="next_attempt_at", nullable = false)
    @Builder.Default
    private Instant nextAttemptAt = Instant.now();

    @Column(name = "last_error_code", length = 64)
    private String lastErrorCode;
}
