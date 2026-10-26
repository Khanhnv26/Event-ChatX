package com.eventchat.modules.room.dto.response;

import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.enums.SessionRole;
import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class RoomAuthResponse {
    private String slug;
    private String title;
    private RoomStatus status;
    private String guestId;
    private String nickname;
    private SessionRole role;
    private String sessionToken;
    private String hostToken;
    private Instant expiresAt;
}
