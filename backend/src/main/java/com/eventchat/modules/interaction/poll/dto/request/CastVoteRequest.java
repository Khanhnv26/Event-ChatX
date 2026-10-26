package com.eventchat.modules.interaction.poll.dto.request;


import jakarta.validation.constraints.NotNull;
import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class CastVoteRequest {

    @NotNull(message = "Phải chọn một lựa chọn")
    private Long optionId;
}
