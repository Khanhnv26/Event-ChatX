package com.eventchat.modules.interaction.poll.dto.response;


import com.eventchat.modules.interaction.poll.enums.PollStatus;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class PollResponse {

    private Long id;
    private long revision;
    private String question;
    private PollStatus status;
    private boolean allowMultiple;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<Long> votedOptionIds;
    private List<PollOptionResponse> options;
    private Instant createdAt;
    private Instant closedAt;
}
