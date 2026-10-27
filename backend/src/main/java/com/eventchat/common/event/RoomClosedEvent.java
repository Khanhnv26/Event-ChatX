package com.eventchat.common.event;

import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@Builder
public class RoomClosedEvent {
    private Long roomId;
    private Instant roomExpiresAt;
    private String slug;
}
