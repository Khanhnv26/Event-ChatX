package com.eventchat.modules.interaction.wheel.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class WheelResponse {
    private Long id;
    private String title;
    private List<String> entries;
    private boolean excludeWinner;
    private Instant createdAt;
    private List<WheelSpinResponse> spins;
}
