package com.eventchat.modules.room.cache;

import com.eventchat.modules.room.enums.SessionRole;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionSnapshot {
    private Long sessionId;
    private Long roomId;
    private String guestId;
    private String nickname;
    private SessionRole role;
}
