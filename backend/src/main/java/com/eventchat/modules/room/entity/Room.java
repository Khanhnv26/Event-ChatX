package com.eventchat.modules.room.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.enums.RoomStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "rooms")
@Builder
public class Room extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_code", length = 16, nullable = false, unique = true)
    private String roomCode;

    @Column(name = "title", length = 255, nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32, nullable = false)
    @Builder.Default
    private RoomStatus status = RoomStatus.ACTIVE;

    @Column(name = "hot_token_hash", length = 64, nullable = false)
    private String hotTokenHash;

    @Column(name = "settings", columnDefinition = "JSON", nullable = false)
    @Builder.Default
    private String settings = "{}";

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
