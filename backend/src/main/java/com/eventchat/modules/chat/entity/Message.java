package com.eventchat.modules.chat.entity;

import com.eventchat.modules.chat.enums.MessageType;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "uk_room_client_msg", def = "{'roomId': 1, 'clientMessageId': 1}", unique = true),
    @CompoundIndex(name = "uk_room_seq", def = "{'roomId': 1, 'sequence': 1}", unique = true)
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private Long roomId;
    private String clientMessageId;
    private Long sequence;

    @Builder.Default
    private MessageType messageType = MessageType.TEXT;

    private SenderInfo sender;
    private String body;
    private ReplyInfo replyTo;

    private Map<String, Object> metadata;

    private Instant createdAt;

    @Indexed(name = "ttl_expires_at", expireAfterSeconds = 0)
    private Instant expiresAt;
}
