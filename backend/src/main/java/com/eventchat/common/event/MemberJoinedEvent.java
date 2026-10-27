package com.eventchat.common.event;

import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
@Getter
@Setter
public class MemberJoinedEvent {
    private Long roomId;
    private Instant roomExpiresAt;
    private String slug;
    private String guestId;
    private String nickname;
}
