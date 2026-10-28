package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.dto.request.CreateRoomRequest;
import com.eventchat.modules.room.dto.request.JoinRoomRequest;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.interaction.poll.dto.request.*;
import com.eventchat.modules.interaction.poll.service.impl.PollServiceImpl;
import com.eventchat.modules.interaction.wheel.dto.request.*;
import com.eventchat.modules.interaction.wheel.service.impl.WheelServiceImpl;
import com.eventchat.modules.decision.dto.request.*;
import com.eventchat.modules.decision.service.impl.DecisionServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import({RoomServiceImpl.class, PollServiceImpl.class, WheelServiceImpl.class,
        DecisionServiceImpl.class, RevokedSessionAuthorizationTest.JsonConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RevokedSessionAuthorizationTest {
    @Autowired RoomServiceImpl roomService;
    @Autowired PollServiceImpl polls;
    @Autowired WheelServiceImpl wheels;
    @Autowired DecisionServiceImpl decisions;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired PlatformTransactionManager transactions;
    @MockBean RoomCacheService cache;
    @MockBean SimpMessagingTemplate broker;

    @TestConfiguration
    static class JsonConfig {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
    }

    enum Command { RECONNECT, CREATE_POLL, VOTE, CREATE_WHEEL, SPIN, CREATE_DECISION, CONFIRM_DECISION }

    @Test
    void kickPreservesHistoryReleasesCapacityAndRejectsCachedChatAuthentication() {
        var host = roomService.createRoom(CreateRoomRequest.builder().title("Kick test").hostNickname("Host").build());
        var guest = roomService.joinRoom(host.getSlug(), JoinRoomRequest.builder().nickname("Guest").build());
        var id = rooms.findBySlug(host.getSlug()).orElseThrow().getId();
        String hash = TokenUtil.sha256(guest.getSessionToken());
        var redis = mock(StringRedisTemplate.class);
        var auth = new SessionCacheServiceImpl(redis, new ObjectMapper(), sessions);
        new TransactionTemplate(transactions).executeWithoutResult(tx ->
                assertEquals(guest.getGuestId(), auth.getByToken(host.getSlug(), id, hash).getGuestId()));
        assertThrows(SecurityException.class, () -> roomService.kickParticipant(host.getSlug(), "wrong", guest.getGuestId()));
        assertThrows(IllegalArgumentException.class, () -> roomService.kickParticipant(host.getSlug(), host.getHostToken(), host.getGuestId()));
        roomService.kickParticipant(host.getSlug(), host.getHostToken(), guest.getGuestId());
        Instant revoked = sessions.findByRoomIdAndGuestId(id, guest.getGuestId()).orElseThrow().getRevokedAt();
        assertNotNull(revoked);
        roomService.kickParticipant(host.getSlug(), host.getHostToken(), guest.getGuestId());
        assertEquals(revoked, sessions.findByRoomIdAndGuestId(id, guest.getGuestId()).orElseThrow().getRevokedAt());
        assertEquals(2, sessions.countByRoomId(id));
        assertEquals(1, sessions.countByRoomIdAndRevokedAtIsNull(id));
        assertEquals(List.of(host.getGuestId()), roomService.getRoomDetails(host.getSlug()).getParticipants()
                .stream().map(p -> p.getGuestId()).toList());
        assertThrows(SecurityException.class, () -> auth.getByToken(host.getSlug(), id, hash));
        verifyNoInteractions(redis);
        assertThrows(SecurityException.class, () -> roomService.reconnect(host.getSlug(), guest.getSessionToken()));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void reconnectCannotUndoConcurrentKick(boolean kickFirst) throws Exception {
        var host = roomService.createRoom(CreateRoomRequest.builder().title("Kick race").hostNickname("Host").build());
        var guest = roomService.joinRoom(host.getSlug(), JoinRoomRequest.builder().nickname("Guest").build());
        Runnable kick = () -> roomService.kickParticipant(host.getSlug(), host.getHostToken(), guest.getGuestId());
        Runnable reconnect = () -> roomService.reconnect(host.getSlug(), guest.getSessionToken());
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch started = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> holder = executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                (kickFirst ? kick : reconnect).run();
                held.countDown();
                try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            }));
            try {
                assertTrue(held.await(10, TimeUnit.SECONDS));
                Future<?> waiter = executor.submit(() -> {
                    started.countDown();
                    (kickFirst ? reconnect : kick).run();
                });
                assertTrue(started.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> waiter.get(200, TimeUnit.MILLISECONDS));
                release.countDown();
                holder.get(15, TimeUnit.SECONDS);
                if (kickFirst) {
                    var error = assertThrows(ExecutionException.class, () -> waiter.get(15, TimeUnit.SECONDS));
                    assertInstanceOf(SecurityException.class, error.getCause());
                } else waiter.get(15, TimeUnit.SECONDS);
            } finally { release.countDown(); }
        }
        var id = rooms.findBySlug(host.getSlug()).orElseThrow().getId();
        assertNotNull(sessions.findByRoomIdAndGuestId(id, guest.getGuestId()).orElseThrow().getRevokedAt());
        assertThrows(SecurityException.class, reconnect::run);
    }

    @ParameterizedTest
    @EnumSource(Command.class)
    void revokedTokenCannotAuthenticateEvenThoughHistoricalSessionStillExists(Command command) {
        var host = roomService.createRoom(CreateRoomRequest.builder().title("Revocation test")
                .hostNickname("Host").ttlMinutes(60).build());
        var room = rooms.findBySlug(host.getSlug()).orElseThrow();
        String hash = TokenUtil.sha256(host.getSessionToken());
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            var session = sessions.findByRoomIdAndSessionTokenHash(room.getId(), hash).orElseThrow();
            session.setRevokedAt(Instant.now());
            sessions.save(session);
        });
        assertTrue(sessions.findByRoomIdAndSessionTokenHash(room.getId(), hash).isPresent());
        assertTrue(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), hash).isEmpty());
        clearInvocations(broker);
        Runnable action = () -> {
            switch (command) {
                case RECONNECT -> roomService.reconnect(host.getSlug(), host.getSessionToken());
                case CREATE_POLL -> polls.createPoll(host.getSlug(), host.getSessionToken(),
                        CreatePollRequest.builder().question("Choose").options(List.of("A", "B")).build());
                case VOTE -> polls.castVote(host.getSlug(), 999L, host.getSessionToken(),
                        CastVoteRequest.builder().optionId(999L).build());
                case CREATE_WHEEL -> wheels.createWheel(host.getSlug(), host.getSessionToken(),
                        CreateWheelRequest.builder().title("Choose").entries(List.of("A", "B")).build());
                case SPIN -> wheels.spinWheel(host.getSlug(), 999L, host.getSessionToken(),
                        SpinWheelRequest.builder().idempotencyKey("revoked").build());
                case CREATE_DECISION -> decisions.createDecision(host.getSlug(), host.getSessionToken(),
                        CreateDecisionRequest.builder().text("Proposal").build());
                case CONFIRM_DECISION -> decisions.confirmDecision(host.getSlug(), 999L,
                        host.getSessionToken(), ConfirmDecisionRequest.builder().build());
            }
        };
        if (command == Command.CREATE_WHEEL || command == Command.SPIN) {
            assertThrows(IllegalArgumentException.class, action::run);
        } else assertThrows(SecurityException.class, action::run);
        verifyNoInteractions(broker);
    }

    @Test
    void tokenFromAnotherRoomCannotReconnect() {
        var first = roomService.createRoom(CreateRoomRequest.builder().title("First").hostNickname("Host").build());
        var second = roomService.createRoom(CreateRoomRequest.builder().title("Second").hostNickname("Host").build());
        assertThrows(SecurityException.class, () -> roomService.reconnect(second.getSlug(), first.getSessionToken()));
        assertNotNull(roomService.reconnect(first.getSlug(), first.getSessionToken()));
    }
}
