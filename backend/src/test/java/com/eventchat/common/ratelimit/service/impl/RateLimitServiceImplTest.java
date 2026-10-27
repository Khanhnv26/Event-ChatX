package com.eventchat.common.ratelimit.service.impl;

import com.eventchat.common.ratelimit.config.RateLimitProperties;
import com.eventchat.common.ratelimit.enums.RateLimitAction;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.model.RateLimitContext;
import com.eventchat.common.ratelimit.service.RateLimitService;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.redis.RedisTokenBucket;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RateLimitServiceImplTest {

    private final RedisTokenBucket tokenBucket = mock(RedisTokenBucket.class);
    private final RateLimitProperties properties = new RateLimitProperties();
    private final RateLimitService service = new RateLimitServiceImpl(tokenBucket, properties);

    @Test
    void publicActionsKeepTheirExistingSharedIpAndRoomScopes() {
        service.check(new RateLimitContext(RateLimitAction.CREATE_ROOM, "127.0.0.1", null, null));
        service.check(new RateLimitContext(RateLimitAction.JOIN_ROOM, "127.0.0.1", "room", null));

        var requests = capturedRequests(2);
        assertEquals(1, requests.get(0).size());
        assertEquals("eventchat:ratelimit:create-room:ip:" + TokenUtil.sha256("127.0.0.1"),
                requests.get(0).getFirst().getKey());
        assertEquals(2, requests.get(1).size());
        assertEquals("eventchat:ratelimit:join-room:ip:" + TokenUtil.sha256("127.0.0.1"),
                requests.get(1).getFirst().getKey());
        assertEquals("eventchat:ratelimit:join-room:room:" + TokenUtil.sha256("room"),
                requests.get(1).get(1).getKey());
    }

    @Test
    void differentSessionsShareIpAndRoomLimitsButHaveIndependentChatBuckets() {
        service.check(new RateLimitContext(RateLimitAction.CHAT, "127.0.0.1", "room", "session-a"));
        service.check(new RateLimitContext(RateLimitAction.CHAT, "127.0.0.1", "room", "session-b"));

        var requests = capturedRequests(2);
        assertEquals(requests.get(0).subList(0, 2), requests.get(1).subList(0, 2));
        assertNotEquals(requests.get(0).get(2).getKey(), requests.get(1).get(2).getKey());
        assertEquals(5, requests.get(0).get(2).getPolicy().getCapacity());
        assertEquals(0.5, requests.get(0).get(2).getPolicy().getRefillPerSecond());
    }

    @Test
    void absentTokenStillConsumesSharedLimitsWithoutCreatingAnActorBucket() {
        service.check(new RateLimitContext(RateLimitAction.CHAT, "127.0.0.1", "room", null));
        assertEquals(2, capturedRequests(1).getFirst().size());
    }

    @Test
    void tokenAndRoomValuesNeverAppearInRedisKeys() {
        service.check(new RateLimitContext(RateLimitAction.HOST_WRITE, "203.0.113.10", "private-room", "host-secret"));
        var buckets = capturedRequests(1).getFirst();
        for (RateLimitBucket bucket : buckets) {
            assertFalse(bucket.getKey().contains("203.0.113.10"));
            assertFalse(bucket.getKey().contains("private-room"));
            assertFalse(bucket.getKey().contains("host-secret"));
        }
        assertEquals(properties.getHostWrite(), buckets.get(2).getPolicy());
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private List<List<RateLimitBucket>> capturedRequests(int count) {
        ArgumentCaptor<List> captor = ArgumentCaptor.forClass(List.class);
        verify(tokenBucket, times(count)).consume(captor.capture());
        return (List) captor.getAllValues();
    }
}
