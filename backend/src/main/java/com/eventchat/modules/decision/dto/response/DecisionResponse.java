package com.eventchat.modules.decision.dto.response;

import com.eventchat.modules.decision.enums.DecisionStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DecisionResponse {

    private Long id;
    private String creatorNickname;
    private String creatorGuestId;
    private String text;
    private DecisionStatus status;
    private List<String> evidenceRefs;
    private long approveCount;
    private long rejectCount;
    private Instant createdAt;
    private Instant confirmedAt;
    private String confirmedByGuestId;
    private String confirmedByNickname;
}
