package com.eventchat.modules.chat.dto.response;

import com.eventchat.modules.chat.enums.MessageType;
import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Setter
@Getter
public class MessageResponse {
    private Long id;
    private String clientMessageId;
    private Long sequence;
    private String senderGuestId;
    private String senderNickname;
    private MessageType messageType;
    private String body;
    private Long replyToId;
    private Instant createdAt;

}
