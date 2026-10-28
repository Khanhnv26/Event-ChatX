package com.eventchat.infrastructure.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomPresenceService {
    private final StringRedisTemplate redis;
    private final String instanceId = UUID.randomUUID().toString();
    private String key(String slug) { return "eventchat:presence:" + slug; }
    private String member(String socketId, String guestId) { return guestId + ":" + instanceId + ":" + socketId; }

    public void touch(String socketId, RealtimeSessionRegistry.Identity identity) {
        try {
            redis.opsForZSet().add(key(identity.slug()), member(socketId, identity.guestId()), System.currentTimeMillis());
            redis.expire(key(identity.slug()), Duration.ofMinutes(2));
        } catch (RuntimeException ignored) { }
    }
    public void remove(String socketId, RealtimeSessionRegistry.Identity identity) {
        try { redis.opsForZSet().remove(key(identity.slug()), member(socketId, identity.guestId())); }
        catch (RuntimeException ignored) { }
    }
    public Set<String> online(String slug) {
        long cutoff = System.currentTimeMillis() - 30000;
        redis.opsForZSet().removeRangeByScore(key(slug), Double.NEGATIVE_INFINITY, cutoff);
        Set<String> members = redis.opsForZSet().rangeByScore(key(slug), cutoff, Double.POSITIVE_INFINITY);
        return members == null ? Set.of() : members.stream().map(value -> value.split(":", 2)[0]).collect(Collectors.toSet());
    }
}
