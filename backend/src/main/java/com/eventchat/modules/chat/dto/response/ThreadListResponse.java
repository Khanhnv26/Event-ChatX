package com.eventchat.modules.chat.dto.response;

import lombok.*;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ThreadListResponse {
    private List<ThreadSummaryResponse> threads;
    private Long nextActivitySequence;
    private boolean hasMore;
}
