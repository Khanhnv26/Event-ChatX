package com.eventchat.modules.chat.entity;

import com.eventchat.modules.room.enums.SessionRole;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SenderInfo {
    private Long sessionId;
    private String guestId;
    private String nickname;
    private SessionRole role;
}
