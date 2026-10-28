package com.eventchat.modules.room.service.impl;

import com.eventchat.infrastructure.redis.RedisKeys;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomRetentionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomRetentionServiceImpl implements RoomRetentionService {
    private final RoomRepository rooms;
    private final RoomSessionRepository sessions;
    private final MessageRepository messages;
    private final JdbcTemplate sql;
    private final StringRedisTemplate redis;

    @Transactional
    @Override
    public boolean purge(String slug) {
        var room = rooms.findBySlugForUpdate(slug).orElse(null);
        if (room == null || room.getExpiresAt().plus(Duration.ofDays(7)).isAfter(Instant.now())) return false;
        Long id = room.getId();
        List<String> keys = new ArrayList<>(List.of(RedisKeys.roomInfo(slug), RedisKeys.roomSeq(id),
                RedisKeys.roomRecent(id), "eventchat:presence:" + slug));
        sessions.findAllByRoomId(id).forEach(session -> keys.add(RedisKeys.session(slug, session.getSessionTokenHash())));
        // Delete Mongo first. If unavailable, SQL is retained and the next job can retry.
        // No distributed rollback: Mongo may already be purged if SQL later fails.
        messages.deleteByRoomId(id);
        sql.update("DELETE FROM decision_confirmations WHERE decision_id IN (SELECT id FROM decisions WHERE room_id=?)", id);
        sql.update("DELETE FROM poll_votes WHERE poll_id IN (SELECT id FROM polls WHERE room_id=?)", id);
        sql.update("DELETE FROM wheel_spins WHERE room_id=?", id);
        sql.update("DELETE FROM poll_options WHERE poll_id IN (SELECT id FROM polls WHERE room_id=?)", id);
        for (String table : List.of("decisions", "wheels", "polls", "room_sessions")) {
            sql.update("DELETE FROM " + table + " WHERE room_id=?", id);
        }
        sql.update("DELETE FROM rooms WHERE id=?", id);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { redis.delete(keys); } catch (RuntimeException ignored) { /* Short-lived caches expire independently. */ }
            }
        });
        return true;
    }
}
