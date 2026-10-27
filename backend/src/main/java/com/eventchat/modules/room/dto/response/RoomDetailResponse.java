package com.eventchat.modules.room.dto.response;

import com.eventchat.modules.room.enums.RoomStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class RoomDetailResponse {
    private String slug;
    private String title;
    private RoomStatus status;
    private String settings;
    private Instant expiresAt;
    private Instant closedAt;
    private Instant createdAt;
    private int maxParticipants;
    private List<ParticipantResponse> participants;
}
