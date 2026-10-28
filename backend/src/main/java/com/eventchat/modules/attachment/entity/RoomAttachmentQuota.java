package com.eventchat.modules.attachment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
