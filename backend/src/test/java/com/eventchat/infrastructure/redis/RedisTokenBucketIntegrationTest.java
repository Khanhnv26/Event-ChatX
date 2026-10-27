package com.eventchat.infrastructure.redis;

import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.ratelimit.config.RateLimitProperties;
import com.eventchat.common.ratelimit.interceptor.RateLimitInterceptor;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.model.TokenBucketPolicy;
import com.eventchat.common.ratelimit.service.impl.RateLimitServiceImpl;
import com.eventchat.common.security.ClientIpResolver;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.modules.chat.controller.ChatController;
import com.eventchat.modules.chat.service.ChatService;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named = "EVENTCHAT_TEST_REDIS", matches = "true")
class RedisTokenBucketIntegrationTest {
    private static LettuceConnectionFactory factory;
    private static StringRedisTemplate redis;
    private final List<String> keys = new ArrayList<>();
    private RedisTokenBucket first;
    private RedisTokenBucket second;

    @BeforeAll
    static void connect() {
        var config = new RedisStandaloneConfiguration(
                System.getenv().getOrDefault("EVENTCHAT_TEST_REDIS_HOST", "127.0.0.1"),
                Integer.parseInt(System.getenv().getOrDefault("EVENTCHAT_TEST_REDIS_PORT", "6379")));
        factory = new LettuceConnectionFactory(config, LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(2)).shutdownTimeout(Duration.ZERO).build());
        factory.afterPropertiesSet();
        redis = new StringRedisTemplate(factory);
        try (var connection = factory.getConnection()) { assertEquals("PONG", connection.ping()); }
    }

    @AfterAll
    static void disconnect() { if (factory != null) factory.destroy(); }

    @BeforeEach
    void instances() {
        first = new RedisTokenBucket(redis);
        second = new RedisTokenBucket(new StringRedisTemplate(factory));
    }

    @AfterEach
    void cleanup() { if (!keys.isEmpty()) redis.delete(keys); }

    @Test
    void chatAllowsABurstOfFiveThenReturnsAWaitTime() {
        var bucket = bucket(5, 0.5);
        for (int i = 0; i < 5; i++) first.consume(List.of(bucket));
        var error = assertThrows(RateLimitExceededException.class, () -> second.consume(List.of(bucket)));
        assertTrue(error.getRetryAfterSeconds() >= 1 && error.getRetryAfterSeconds() <= 2);
    }

    @Test
    void refillsUsingRedisTimeAndCapsTheNumberOfTokens() {
        var bucket = bucket(5, 0.5);
        long now = serverTime();
        redis.opsForHash().putAll(bucket.getKey(), Map.of("tokens", "0", "updated", Long.toString(now - 2100)));
        first.consume(List.of(bucket));
        assertThrows(RateLimitExceededException.class, () -> first.consume(List.of(bucket)));
        redis.opsForHash().putAll(bucket.getKey(), Map.of("tokens", "100", "updated", Long.toString(serverTime())));
        for (int i = 0; i < 5; i++) first.consume(List.of(bucket));
        assertThrows(RateLimitExceededException.class, () -> first.consume(List.of(bucket)));
    }

    @Test
    void denyingAnyBucketDoesNotConsumeTheOthers() {
        var actor = bucket(1, 0.000001);
        var room = bucket(1, 0.000001);
        first.consume(List.of(room));
        assertThrows(RateLimitExceededException.class, () -> first.consume(List.of(actor, room)));
        assertFalse(Boolean.TRUE.equals(redis.hasKey(actor.getKey())));
        assertDoesNotThrow(() -> second.consume(List.of(actor)));
        assertThrows(RateLimitExceededException.class, () -> first.consume(List.of(actor)));
    }

    @Test
    void twoInstancesShareExactlyOneCapacityUnderConcurrentRequests() throws Exception {
        var bucket = bucket(5, 0.000001);
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(16)) {
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < 32; i++) {
                RedisTokenBucket instance = i % 2 == 0 ? first : second;
                futures.add(executor.submit(() -> {
                    try {
                        assertTrue(start.await(5, TimeUnit.SECONDS));
                        instance.consume(List.of(bucket));
                        accepted.incrementAndGet();
                    } catch (RateLimitExceededException expected) {
                        rejected.incrementAndGet();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(interrupted);
                    }
                }));
            }
            start.countDown();
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        }
        assertEquals(5, accepted.get());
        assertEquals(27, rejected.get());
    }

    @Test
    void idleBucketsHaveABoundedExpiry() {
        var bucket = bucket(5, 0.5);
        first.consume(List.of(bucket));
        Long ttl = redis.getExpire(bucket.getKey(), TimeUnit.MILLISECONDS);
        assertNotNull(ttl);
        assertTrue(ttl > 0 && ttl <= 10_000);
    }

    @Test
    void backwardsClockDoesNotMintTokens() {
        var bucket = bucket(1, 0.5);
        redis.opsForHash().putAll(bucket.getKey(), Map.of("tokens", "0", "updated", Long.toString(serverTime() + 5000)));
        assertThrows(RateLimitExceededException.class, () -> first.consume(List.of(bucket)));
    }

    @Test
    void realRedisRejectsTheSixthHttpMessageBeforeCallingChat() throws Exception {
        var policies = new RateLimitProperties();
        policies.setKeyPrefix("eventchat:test:ratelimit:" + UUID.randomUUID() + ":");
        policies.setChat(new TokenBucketPolicy(5, 0.000001));
        var trackingLimiter = new RedisTokenBucket(redis) {
            @Override public void consume(List<RateLimitBucket> buckets) {
                buckets.stream().map(RateLimitBucket::getKey).forEach(keys::add);
                super.consume(buckets);
            }
        };
        ChatService chat = mock(ChatService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new ChatController(chat))
                .addInterceptors(new RateLimitInterceptor(
                        new RateLimitServiceImpl(trackingLimiter, policies), new ClientIpResolver(policies)))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/rooms/room/messages").header("X-Session-Token", "test-session")
                            .contentType("application/json").content("{\"clientMessageId\":\"id\",\"body\":\"Hello\"}"))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/v1/rooms/room/messages").header("X-Session-Token", "test-session")
                        .contentType("application/json").content("{\"clientMessageId\":\"id\",\"body\":\"Hello\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        verify(chat, times(5)).sendMessage(eq("room"), eq("test-session"), any());
        verifyNoMoreInteractions(chat);
    }

    private RateLimitBucket bucket(long capacity, double refill) {
        String key = "eventchat:test:ratelimit:" + UUID.randomUUID();
        keys.add(key);
        return new RateLimitBucket(key, new TokenBucketPolicy(capacity, refill));
    }

    private long serverTime() {
        return Objects.requireNonNull(redis.execute(new DefaultRedisScript<>(
                "local t=redis.call('TIME'); return tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)",
                Long.class), List.of()));
    }
}
