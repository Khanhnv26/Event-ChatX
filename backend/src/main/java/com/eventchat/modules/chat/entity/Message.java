package com.eventchat.modules.chat.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "messages", uniqueConstraints = {
        @UniqueConstraint(name = "uk_message_id", columnNames = {"room_id", "client_message_id"}),
        @UniqueConstraint(name = "uk_room_message", columnNames = {"room_id", "sequence"})
})
@Builder
public class Message extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_session_id", nullable = true)
    private RoomSession authorSession;

    @Column(name = "client_message_id", length = 64, nullable = false)
    private String clientMessageId;

    @Column(name = "sequence", nullable = false)
    private Long sequence;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", length = 32, nullable = false)
    @Builder.Default
    private MessageType messageType = MessageType.TEXT;

    @Column(name = "body", length = 2048, nullable = false)
    private String body;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reply_to_id")
    private Message replyTo;
}
