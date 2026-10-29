package com.eventchat.modules.chat.repository;

import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ThreadActivity {
    @Id private String id;
    private long replyCount;
    private long lastActivitySequence;
    private Instant lastActivityAt;
    private String lastReplySnippet;
}
