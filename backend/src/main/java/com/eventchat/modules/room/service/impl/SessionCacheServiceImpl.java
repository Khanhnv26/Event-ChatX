package com.eventchat.modules.room.service.impl;

import com.eventchat.infrastructure.redis.RedisKeys;
import com.eventchat.modules.room.cache.SessionSnapshot;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.SessionCacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class SessionCacheServiceImpl implements SessionCacheService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final RoomSessionRepository roomSessionRepository;

    @Override
    public SessionSnapshot getByToken(String slug, Long roomId, String tokenHash) {

        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(roomId, tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi"));

        return SessionSnapshot.builder()
                .sessionId(session.getId())
                .roomId(session.getRoom().getId())
                .guestId(session.getGuestId())
                .nickname(session.getNickname())
                .role(session.getRole())
                .build();
    }

    @Override
    public void evict(String slug, String tokenHash) {
        try {
            redis.delete(RedisKeys.session(slug, tokenHash));
        } catch (Exception ignored) {
        }
    }
}
