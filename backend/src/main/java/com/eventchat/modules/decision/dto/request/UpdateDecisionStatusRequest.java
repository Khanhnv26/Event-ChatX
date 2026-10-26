package com.eventchat.modules.decision.dto.request;

import com.eventchat.modules.decision.enums.DecisionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateDecisionStatusRequest {

    @NotNull(message = "Trạng thái mới không được để trống")
    private DecisionStatus status;
}
