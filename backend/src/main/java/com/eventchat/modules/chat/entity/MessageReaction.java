package com.eventchat.modules.chat.entity;

import com.eventchat.modules.chat.enums.ReactionEmoji;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "message_reactions", uniqueConstraints = @UniqueConstraint(
        name = "uq_message_reactions", columnNames = {"room_id", "message_id", "session_id", "emoji"}))
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "message_id", length = 64, nullable = false)
    private String messageId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private ReactionEmoji emoji;
}
