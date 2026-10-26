package com.eventchat.modules.decision.dto.request;

import com.eventchat.modules.decision.enums.ConfirmationChoice;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfirmDecisionRequest {

    @NotNull(message = "Lựa chọn xác nhận không được để trống")
    private ConfirmationChoice choice;
}
