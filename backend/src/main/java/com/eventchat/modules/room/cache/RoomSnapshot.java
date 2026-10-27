package com.eventchat.modules.room.cache;

import com.eventchat.modules.room.enums.RoomStatus;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomSnapshot {
    private Long id;
    private String slug;
    private RoomStatus status;
    private Instant expiresAt;

    public boolean isWritable() {
        return status == RoomStatus.ACTIVE && Instant.now().isBefore(expiresAt);
    }
}
