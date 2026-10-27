package com.eventchat.modules.chat.service.impl;

import com.eventchat.infrastructure.redis.RedisKeys;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.chat.service.SequenceGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class RedisSequenceGenerator implements SequenceGenerator {

    private final StringRedisTemplate stringRedisTemplate;
    private final MessageRepository messageRepository;

    @Override
    public long next(Long roomId, Instant roomExpiresAt) {
        String key = RedisKeys.roomSeq(roomId);

        if (Boolean.FALSE.equals(stringRedisTemplate.hasKey(key))) {
            long maxFromDb = getMaxSequenceFromMongo(roomId);
            stringRedisTemplate.opsForValue().setIfAbsent(key, String.valueOf(maxFromDb), calculateTtl(roomExpiresAt));
        }

        Long value = stringRedisTemplate.opsForValue().increment(key);
        return value != null ? value : 1L;
    }

    @Override
    public void resync(Long roomId, Instant roomExpiresAt) {
        String key = RedisKeys.roomSeq(roomId);
        long maxFromDb = getMaxSequenceFromMongo(roomId);
        stringRedisTemplate.opsForValue().set(key, String.valueOf(maxFromDb), calculateTtl(roomExpiresAt));
    }

    private long getMaxSequenceFromMongo(Long roomId) {
        return messageRepository.findTopByRoomIdOrderBySequenceDesc(roomId)
                .map(Message::getSequence)
                .orElse(0L);
    }

    private Duration calculateTtl(Instant roomExpiresAt) {
        Duration duration = Duration.between(Instant.now(), roomExpiresAt).plusDays(1);
        if (duration.isNegative() || duration.compareTo(Duration.ofHours(1)) < 0) {
            return Duration.ofHours(1);
        }
        return duration;
    }
}