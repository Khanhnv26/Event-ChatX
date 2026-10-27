package com.eventchat.infrastructure.redis;

import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.exception.RateLimitUnavailableException;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class RedisTokenBucket {
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<List> script;

    public RedisTokenBucket(StringRedisTemplate redis) {
        this.redis = redis;
        script = new DefaultRedisScript<>();
        script.setLocation(new ClassPathResource("redis/token-bucket.lua"));
        script.setResultType(List.class);
    }


    public void consume(List<RateLimitBucket> buckets) {
        if (buckets.isEmpty()) {
            return;
        }
        List<String> keys = buckets.stream().map(RateLimitBucket::getKey).toList();
        if (keys.stream().distinct().count() != keys.size()) {
            throw new IllegalArgumentException("Duplicate token bucket keys");
        }
        List<String> args = new ArrayList<>();
        for (RateLimitBucket bucket : buckets) {
            args.add(Long.toString(bucket.getPolicy().getCapacity()));
            args.add(Double.toString(bucket.getPolicy().getRefillPerSecond()));
        }
        List<?> result;
        try {
            result = redis.execute(script, keys, args.toArray());
        } catch (DataAccessException | IllegalStateException error) {
            throw new RateLimitUnavailableException();
        }
        if (result == null || result.size() != 2 || !(result.get(0) instanceof Number allowed)
                || !(result.get(1) instanceof Number retry)) {
            throw new RateLimitUnavailableException();
        }
        if (allowed.longValue() == 0) {
            throw new RateLimitExceededException(retry.longValue());
        }
        if (allowed.longValue() != 1) {
            throw new RateLimitUnavailableException();
        }
    }
}
