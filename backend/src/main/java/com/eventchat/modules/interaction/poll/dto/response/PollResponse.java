package com.eventchat.modules.interaction.poll.dto.response;


import com.eventchat.modules.interaction.poll.enums.PollStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class PollResponse {

    private Long id;
    private String question;
    private PollStatus status;
    private boolean allowMultiple;
    private List<PollOptionResponse> options;
    private Instant createdAt;
    private Instant closedAt;
}
