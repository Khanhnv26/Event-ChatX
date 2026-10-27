package com.eventchat.infrastructure.redis;

import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.exception.RateLimitUnavailableException;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.model.TokenBucketPolicy;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
class RedisTokenBucketTest {
    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private final RedisTokenBucket limiter = new RedisTokenBucket(redis);
    private final RateLimitBucket bucket = new RateLimitBucket("test", new TokenBucketPolicy(5, 0.5));

    @Test
    void redisFailureDoesNotAllowAnUnmeteredWrite() {
        doThrow(new DataAccessResourceFailureException("offline"))
                .when(redis).execute(any(RedisScript.class), anyList(), any(Object[].class));
        assertThrows(RateLimitUnavailableException.class, () -> limiter.consume(List.of(bucket)));
    }

    @Test
    void nullOrMalformedResultDoesNotAllowAnUnmeteredWrite() {
        assertThrows(RateLimitUnavailableException.class, () -> limiter.consume(List.of(bucket)));
        doReturn(List.of(8L, 0L)).when(redis).execute(any(RedisScript.class), anyList(), any(Object[].class));
        assertThrows(RateLimitUnavailableException.class, () -> limiter.consume(List.of(bucket)));
    }

    @Test
    void roundsRetryAfterUpToWholeSeconds() {
        doReturn(List.of(0L, 1501L)).when(redis).execute(any(RedisScript.class), anyList(), any(Object[].class));
        var error = assertThrows(RateLimitExceededException.class, () -> limiter.consume(List.of(bucket)));
        assertEquals(2, error.getRetryAfterSeconds());
    }

    @Test
    void invalidConfigurationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new TokenBucketPolicy(0, 1));
        assertThrows(IllegalArgumentException.class, () -> new TokenBucketPolicy(1, 0));
        assertThrows(IllegalArgumentException.class, () -> new TokenBucketPolicy(1, Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> new TokenBucketPolicy(1, Double.POSITIVE_INFINITY));
    }
}
