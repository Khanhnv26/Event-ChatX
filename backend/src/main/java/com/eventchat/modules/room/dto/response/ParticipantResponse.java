package com.eventchat.modules.room.dto.response;

import com.eventchat.modules.room.enums.SessionRole;
import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class ParticipantResponse {
    private String guestId;
    private String nickname;
    private SessionRole role;
    private Instant joinedAt;
    private Instant lastSeenAt;
}
