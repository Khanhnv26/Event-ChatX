package com.eventchat.modules.interaction.wheel.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class SpinWheelRequest {

    @NotBlank(message = "Idempotency key không được để trống")
    private String idempotencyKey;
}
