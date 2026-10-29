package com.eventchat.modules.chat.dto.response;

import lombok.*;
import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ThreadSummaryResponse {
    private MessageResponse rootMessage;
    private long replyCount;
    private long lastActivitySequence;
    private Instant lastActivityAt;
    private String lastReplySnippet;
}
