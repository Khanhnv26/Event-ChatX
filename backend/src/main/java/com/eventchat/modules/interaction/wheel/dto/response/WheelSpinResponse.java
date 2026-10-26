package com.eventchat.modules.interaction.wheel.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class WheelSpinResponse {

    private Long id;
    private Long wheelId;
    private String actorNickname;
    private String idempotencyKey;
    private String resultEntry;
    private List<String> entriesSnapshot;
    private Instant createdAt;

}
