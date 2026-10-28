package com.eventchat.modules.room.job;

import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.service.RoomRetentionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.Duration;

@Component
@RequiredArgsConstructor
@Slf4j
public class RoomRetentionJob {
    private final RoomRepository rooms;
    private final RoomRetentionService retention;

    @Scheduled(fixedDelayString = "${app.retention.interval-ms:3600000}", initialDelayString = "${app.retention.initial-delay-ms:60000}")
    public void purgeExpiredData() {
        var slugs = rooms.findSlugsForRetention(Instant.now().minus(Duration.ofDays(7)), PageRequest.of(0, 25));
        for (String slug : slugs) {
            try { if (retention.purge(slug)) log.info("Purged expired room {}", slug); }
            catch (RuntimeException failure) { log.warn("Room retention failed; will retry room={}", slug); }
        }
    }
}
