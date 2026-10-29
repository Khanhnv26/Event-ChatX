package com.eventchat.modules.chat.dto.response;

import lombok.*;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ThreadResponse {
    private MessageResponse rootMessage;
    private List<MessageResponse> messages;
    private long nextSequence;
    private boolean hasMore;
}
