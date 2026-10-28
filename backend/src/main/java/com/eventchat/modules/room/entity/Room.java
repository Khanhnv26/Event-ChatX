package com.eventchat.modules.room.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.enums.RoomStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "rooms")
@Builder
public class Room extends BaseEntity {

    @Column(name = "slug", length = 32, nullable = false, unique = true)
    private String slug;

    @Column(name = "title", length = 255, nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_status", length = 32, nullable = false)
    @Builder.Default
    private RoomStatus roomStatus = RoomStatus.ACTIVE;

    @Column(name = "host_token_hash", length = 64, nullable = false)
    private String hostTokenHash;

    @Column(name = "retention_policy", length = 64, nullable = false)
    @Builder.Default
    private String retentionPolicy = "KEEP_7_DAYS_AFTER_EXPIRY";

    @Column(name = "settings", length = 1024, nullable = false)
    @Builder.Default
    private String settings = "{}";

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "max_participants", nullable = false)
    @Builder.Default
    private int maxParticipants = 50;

    @Column(name = "join_locked", nullable = false)
    @Builder.Default
    private boolean joinLocked = false;

    @Column(name = "closed_at", nullable = true)
    private Instant closedAt;
}
