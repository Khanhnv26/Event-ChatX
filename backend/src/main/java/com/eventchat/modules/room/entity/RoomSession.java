package com.eventchat.modules.room.entity;


import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.enums.SessionRole;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "room_sessions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_room_session_token", columnNames = {"room_id", "session_token_hash"})
})
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class RoomSession extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "session_token_hash", length = 64, nullable = false)
    private String sessionTokenHash;

    @Column(name = "nickname", length = 64, nullable = false)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 32, nullable = false)
    @Builder.Default
    private SessionRole role = SessionRole.Participant;

    @CreationTimestamp
    @Column(name = "joined_at", updatable = false, nullable = false)
    private Instant joinedAt;

    @Column(name = "last_seen_at", nullable = false)
    @Builder.Default
    private Instant lastSeenAt = Instant.now();
}
