package com.eventchat.modules.export.dto.response;

import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.wheel.dto.response.WheelResponse;
import com.eventchat.modules.room.enums.RoomStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomExportResponse {
    private String roomSlug;
    private String roomTitle;
    private RoomStatus roomStatus;
    private int participantCount;
    private List<DecisionResponse> confirmedDecisions;
    private List<PollResponse> polls;
    private List<WheelResponse> wheels;
    private String markdownSummary;
    private Instant exportedAt;
}
