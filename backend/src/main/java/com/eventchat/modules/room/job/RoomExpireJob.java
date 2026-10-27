package com.eventchat.modules.room.job;

import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.room.service.RoomCacheInvalidation;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class RoomExpireJob {

    private final RoomRepository roomRepository;
    private final RoomCacheService roomCacheService;

    @Transactional
    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void expireRooms() {
        List<String> slugs = roomRepository.findSlugsToExpire(RoomStatus.EXPIRED, Instant.now());

        if (slugs.isEmpty()) {
            return;
        }

        int updated = roomRepository.maxExpired(RoomStatus.EXPIRED, slugs);
        RoomCacheInvalidation.afterCommit(roomCacheService, slugs);
    }
}
