package com.eventchat.common.ratelimit.interceptor;

import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.exception.RateLimitUnavailableException;
import com.eventchat.common.ratelimit.config.RateLimitProperties;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.service.impl.RateLimitServiceImpl;
import com.eventchat.common.security.ClientIpResolver;
import com.eventchat.infrastructure.redis.RedisTokenBucket;
import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.modules.chat.controller.ChatController;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.room.controller.RoomController;
import com.eventchat.modules.room.service.RoomService;
import com.eventchat.modules.interaction.poll.controller.PollController;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.interaction.wheel.controller.WheelController;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.decision.controller.DecisionController;
import com.eventchat.modules.decision.service.DecisionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RateLimitHttpTest {
    private final RedisTokenBucket limiter = mock(RedisTokenBucket.class);
    private final RateLimitProperties policies = new RateLimitProperties();
    private final ClientIpResolver clientIpResolver = new ClientIpResolver(policies);
    private final RateLimitInterceptor interceptor = new RateLimitInterceptor(
            new RateLimitServiceImpl(limiter, policies), clientIpResolver);
    private final ChatService chat = mock(ChatService.class);
    private final RoomService rooms = mock(RoomService.class);
    private final PollService polls = mock(PollService.class);
    private final WheelService wheels = mock(WheelService.class);
    private final DecisionService decisions = mock(DecisionService.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ChatController(chat), new RoomController(rooms),
                    new PollController(polls), new WheelController(wheels), new DecisionController(decisions))
            .addInterceptors(interceptor).setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test
    void rateLimitedMessageReturns429AndDoesNotReachChatService() throws Exception {
        doThrow(new RateLimitExceededException(1501)).when(limiter).consume(anyList());
        mvc.perform(post("/api/v1/rooms/room/messages").header("X-Session-Token", "secret-session")
                        .contentType("application/json").content("{\"clientMessageId\":\"id\",\"body\":\"Hello\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "2"))
                .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(chat);
    }

    @Test
    void redisOutageReturns503ButDoesNotBlockHistoryReads() throws Exception {
        doThrow(new RateLimitUnavailableException()).when(limiter).consume(anyList());
        mvc.perform(post("/api/v1/rooms/room/messages").header("X-Session-Token", "secret-session")
                        .contentType("application/json").content("{\"clientMessageId\":\"id\",\"body\":\"Hello\"}"))
                .andExpect(status().isServiceUnavailable()).andExpect(header().string("Retry-After", "1"));
        verifyNoInteractions(chat);
        mvc.perform(get("/api/v1/rooms/room/messages")).andExpect(status().isOk());
        verify(chat).getMessages("room", null);
        verify(limiter, times(1)).consume(anyList());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void chatUsesAtomicIpRoomAndSessionBucketsWithoutRawSecrets() throws Exception {
        mvc.perform(post("/api/v1/rooms/room/messages").header("X-Session-Token", "secret-session")
                        .contentType("application/json").content("{\"clientMessageId\":\"id\",\"body\":\"Hello\"}"))
                .andExpect(status().isOk());
        ArgumentCaptor<List> captured = ArgumentCaptor.forClass(List.class);
        verify(limiter).consume(captured.capture());
        List<RateLimitBucket> buckets = captured.getValue();
        assertEquals(3, buckets.size());
        assertTrue(buckets.stream().noneMatch(bucket -> bucket.getKey().contains("secret-session")));
        assertEquals(policies.getChat(), buckets.get(2).getPolicy());
        assertEquals(5, buckets.get(2).getPolicy().getCapacity());
        assertEquals(0.5, buckets.get(2).getPolicy().getRefillPerSecond());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/rooms", "/api/v1/rooms/room/join", "/api/v1/rooms/room/reconnect"})
    void publicEntryPointsAreLimitedBeforeCreatingASession(String path) throws Exception {
        doThrow(new RateLimitExceededException(1000)).when(limiter).consume(anyList());
        mvc.perform(post(path).contentType("application/json").content("{}"))
                .andExpect(status().isTooManyRequests());
        verifyNoInteractions(rooms);
    }

    @Test
    void forwardedAddressIsIgnoredForAnUntrustedPeer() {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.10");
        request.addHeader("X-Forwarded-For", "198.51.100.20");
        assertEquals("203.0.113.10", clientIpResolver.resolve(request));
    }

    @Test
    void trustedProxyChainUsesTheFirstUntrustedPeerFromTheRight() {
        policies.setTrustedProxies(Set.of("127.0.0.1", "192.0.2.10"));
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.99, 203.0.113.20, 192.0.2.10");
        assertEquals("203.0.113.20", clientIpResolver.resolve(request));
    }

    static Stream<Arguments> toolRequests() {
        return Stream.of(
                Arguments.of("POST", "/polls", "tool-create", false),
                Arguments.of("POST", "/polls/1/votes", "vote", false),
                Arguments.of("POST", "/polls/1/close", "host-write", true),
                Arguments.of("POST", "/wheels", "tool-create", false),
                Arguments.of("POST", "/wheels/1/spin", "spin", false),
                Arguments.of("POST", "/decisions", "tool-create", false),
                Arguments.of("POST", "/decisions/1/confirm", "vote", false),
                Arguments.of("PATCH", "/decisions/1/status", "host-write", true),
                Arguments.of("POST", "/close", "host-write", true));
    }

    @ParameterizedTest
    @MethodSource("toolRequests")
    @SuppressWarnings({"rawtypes", "unchecked"})
    void toolCommandsAreMeteredBeforeExecutingTheController(String method, String suffix, String action,
                                                           boolean hostCommand) throws Exception {
        doThrow(new RateLimitExceededException(1000)).when(limiter).consume(anyList());
        var request = method.equals("PATCH") ? patch("/api/v1/rooms/room" + suffix)
                : post("/api/v1/rooms/room" + suffix);
        mvc.perform(request.header("X-Session-Token", "session-secret").header("X-Host-Token", "host-secret")
                        .contentType("application/json").content("{}"))
                .andExpect(status().isTooManyRequests());
        ArgumentCaptor<List> captured = ArgumentCaptor.forClass(List.class);
        verify(limiter).consume(captured.capture());
        List<RateLimitBucket> buckets = captured.getValue();
        assertEquals(3, buckets.size());
        assertTrue(buckets.get(2).getKey().contains(":" + action + ":room:"));
        assertTrue(buckets.get(2).getKey().endsWith(com.eventchat.common.util.TokenUtil.sha256(
                hostCommand ? "host-secret" : "session-secret")));
        verifyNoInteractions(chat, rooms, polls, wheels, decisions);
    }
}
