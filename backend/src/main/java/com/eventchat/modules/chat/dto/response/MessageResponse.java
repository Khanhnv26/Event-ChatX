package com.eventchat.modules.chat.dto.response;

import com.eventchat.modules.chat.enums.MessageType;
import lombok.*;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Setter
@Getter
public class MessageResponse {
    private String id;
    private String clientMessageId;
    private Long sequence;
    private String senderGuestId;
    private String senderNickname;
    private MessageType messageType;
    private String body;
    private String replyToId;
    private String threadRootId;
    private long threadReplyCount;
    private Instant createdAt;
    private Map<String, Object> metadata;
    private List<AttachmentResponse> attachments;
}
