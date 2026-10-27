package com.eventchat.modules.room.service.impl;

import com.eventchat.infrastructure.redis.RedisKeys;
import com.eventchat.modules.room.cache.RoomSnapshot;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.service.RoomCacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RoomCacheServiceImpl implements RoomCacheService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final RoomRepository roomRepository;

    @Override
    public RoomSnapshot getBySlug(String slug) {
        String key = RedisKeys.roomInfo(slug);
        try {
            String json = redis.opsForValue().get(key);
            if (json != null && !json.isBlank()) {
                return objectMapper.readValue(json, RoomSnapshot.class);
            }
        } catch (Exception ignored) {
        }

        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không thấy phòng chat với code: " + slug));

        RoomSnapshot snapshot = RoomSnapshot.builder()
                .id(room.getId())
                .slug(room.getSlug())
                .status(room.getRoomStatus())
                .expiresAt(room.getExpiresAt())
                .build();

        try {
            String json = objectMapper.writeValueAsString(snapshot);
            redis.opsForValue().set(key, json, Duration.ofMinutes(10));
        } catch (Exception ignored) {
        }

        return snapshot;
    }

    @Override
    public void evict(String slug) {
        try {
            redis.delete(RedisKeys.roomInfo(slug));
        } catch (Exception ignored) {
        }
    }
}
