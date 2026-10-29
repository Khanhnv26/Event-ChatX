package com.eventchat.modules.interaction.poll.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UpdateVotesRequest {
    @NotNull
    @Size(max = 10)
    private List<@NotNull @Positive Long> optionIds;
}
