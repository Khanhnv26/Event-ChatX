package com.eventchat.modules.decision.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.common.event.RoomClosedEvent;
import com.eventchat.modules.decision.dto.request.ConfirmDecisionRequest;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.dto.request.UpdateDecisionStatusRequest;
import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.enums.ConfirmationChoice;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.repository.DecisionConfirmationRepository;
import com.eventchat.modules.decision.repository.DecisionRepository;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.room.service.impl.RoomServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntConsumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import({DecisionServiceImpl.class, RoomServiceImpl.class, DecisionConcurrencyTest.JsonConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class DecisionConcurrencyTest {
    @Autowired DecisionServiceImpl service;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired DecisionRepository decisions;
    @Autowired DecisionConfirmationRepository confirmations;
    @Autowired com.eventchat.modules.interaction.wheel.repository.WheelRepository wheels;
    @Autowired com.eventchat.modules.interaction.wheel.repository.WheelSpinRepository spins;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired RoomServiceImpl roomService;
    @Autowired CloseEvents closeEvents;
    @MockBean SimpMessagingTemplate broker;
    @MockBean RoomCacheService roomCache;

    @TestConfiguration
    static class JsonConfig {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean CloseEvents closeEvents() { return new CloseEvents(); }
    }

    static class CloseEvents {
        private final ConcurrentLinkedQueue<RoomClosedEvent> events = new ConcurrentLinkedQueue<>();

        @TransactionalEventListener
        public void onClosed(RoomClosedEvent event) { events.add(event); }
    }

    enum WriteCommand { CREATE, VOTE, UPDATE }

    @BeforeEach
    void clearEvents() { closeEvents.events.clear(); }

    @Test
    void competingFinalizationsCommitExactlyOneTerminalStateAndOneEvent() throws Exception {
        Fixture fixture = setup();
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        concurrently(index -> {
            try {
                service.updateDecisionStatus(fixture.slug(), fixture.decisionId(), "host",
                        UpdateDecisionStatusRequest.builder().status(index % 2 == 0
                                ? DecisionStatus.CONFIRMED : DecisionStatus.REJECTED).build());
                accepted.incrementAndGet();
            } catch (IllegalArgumentException invalidTransition) {
                assertTrue(invalidTransition.getMessage().contains("trạng thái"));
                rejected.incrementAndGet();
            }
        });

        assertEquals(1, accepted.get());
        assertEquals(7, rejected.get());
        Decision saved = decisions.findById(fixture.decisionId()).orElseThrow();
        assertTrue(saved.getStatus() == DecisionStatus.CONFIRMED || saved.getStatus() == DecisionStatus.REJECTED);
        assertEquals(saved.getStatus() == DecisionStatus.CONFIRMED, saved.getConfirmedAt() != null);
        verify(broker, times(1)).convertAndSend(eq("/topic/room." + fixture.slug() + ".decisions"), any(Object.class));
    }

    @Test
    void concurrentVotesFromOneGuestCreateOnlyOneConfirmation() throws Exception {
        Fixture fixture = setup();
        concurrently(index -> service.confirmDecision(fixture.slug(), fixture.decisionId(), "guest",
                ConfirmDecisionRequest.builder().choice(ConfirmationChoice.APPROVE).build()));
        assertEquals(1, confirmations.findAllByDecisionId(fixture.decisionId()).size());
        assertEquals(1, confirmations.countByDecisionIdAndChoice(fixture.decisionId(), ConfirmationChoice.APPROVE));
        assertEquals(DecisionStatus.PROPOSED, decisions.findById(fixture.decisionId()).orElseThrow().getStatus());
    }

    @Test
    void concurrentSavesOfOneSpinCreateOneContextualProposal() throws Exception {
        Fixture fixture = setup();
        Long spinId = new TransactionTemplate(transactionManager).execute(tx -> {
            Room room = rooms.findById(fixture.roomId()).orElseThrow();
            RoomSession host = sessions.save(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                    .nickname("Host").role(com.eventchat.modules.room.enums.SessionRole.HOST)
                    .sessionTokenHash(TokenUtil.sha256("host-session")).build());
            var wheel = wheels.save(com.eventchat.modules.interaction.wheel.entity.Wheel.builder().room(room)
                    .title("Dinner").entries("[\"Host\",\"Guest\"]").rules("{}").build());
            return spins.save(com.eventchat.modules.interaction.wheel.entity.WheelSpin.builder().room(room).wheel(wheel)
                    .roomSession(host).resultEntry("Host").entriesSnapshot("[\"Host\",\"Guest\"]")
                    .idempotencyKey(UUID.randomUUID().toString()).build()).getId();
        });
        var ids = ConcurrentHashMap.<Long>newKeySet();
        concurrently(index -> ids.add(service.createDecision(fixture.slug(), "host-session", CreateDecisionRequest.builder()
                .text("Người bao kèo lẩu").sourceSpinId(spinId).build()).getId()));
        assertEquals(1, ids.size());
        assertEquals(2, decisions.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals("Người bao kèo lẩu → Host", decisions.findById(ids.iterator().next()).orElseThrow().getText());
        verify(broker, times(1)).convertAndSend(eq("/topic/room." + fixture.slug() + ".decisions"), any(Object.class));
    }

    @Test
    void confirmerSnapshotSurvivesReloadNicknameChangesAndWithdrawal() {
        Fixture fixture = setup();
        Long hostId = new TransactionTemplate(transactionManager).execute(tx -> sessions.save(RoomSession.builder()
                .room(rooms.findById(fixture.roomId()).orElseThrow()).guestId(UUID.randomUUID().toString())
                .nickname("Lan").role(com.eventchat.modules.room.enums.SessionRole.HOST)
                .sessionTokenHash(TokenUtil.sha256("host-session")).build()).getId());
        service.updateDecisionStatus(fixture.slug(), fixture.decisionId(), "host", "host-session",
                UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build());
        new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            RoomSession host = sessions.findById(hostId).orElseThrow();
            host.setNickname("Updated");
            sessions.save(host);
        });
        var reloaded = service.getDecisionsByRoom(fixture.slug()).getFirst();
        assertEquals("Guest", reloaded.getCreatorNickname());
        assertEquals("Lan", reloaded.getConfirmedByNickname());
        assertNotNull(reloaded.getConfirmedByGuestId());
        var withdrawn = service.removeDecision(fixture.slug(), fixture.decisionId(), "host-session");
        assertEquals("Lan", withdrawn.getConfirmedByNickname());
        assertEquals(reloaded.getConfirmedAt(), withdrawn.getConfirmedAt());
        assertEquals(DecisionStatus.WITHDRAWN, withdrawn.getStatus());
    }

    @Test
    void voteWaitingForFinalizationCannotWriteAfterDecisionIsConfirmed() throws Exception {
        Fixture fixture = setup();
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch voting = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> finalizer = executor.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                service.updateDecisionStatus(fixture.slug(), fixture.decisionId(), "host",
                        UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build());
                locked.countDown();
                await(release);
            }));
            try {
                assertTrue(locked.await(10, TimeUnit.SECONDS));
                Future<?> voter = executor.submit(() -> {
                    voting.countDown();
                    service.confirmDecision(fixture.slug(), fixture.decisionId(), "guest",
                            ConfirmDecisionRequest.builder().choice(ConfirmationChoice.APPROVE).build());
                });
                assertTrue(voting.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> voter.get(200, TimeUnit.MILLISECONDS));
                release.countDown();
                finalizer.get(15, TimeUnit.SECONDS);
                ExecutionException error = assertThrows(ExecutionException.class,
                        () -> voter.get(15, TimeUnit.SECONDS));
                assertInstanceOf(IllegalArgumentException.class, error.getCause());
            } finally {
                release.countDown();
            }
        }
        assertEquals(DecisionStatus.CONFIRMED, decisions.findById(fixture.decisionId()).orElseThrow().getStatus());
        assertTrue(confirmations.findAllByDecisionId(fixture.decisionId()).isEmpty());
        verify(broker, times(1)).convertAndSend(eq("/topic/room." + fixture.slug() + ".decisions"), any(Object.class));
    }

    @Test
    void lockingQueryCannotSelectADecisionFromAnotherRoom() {
        Fixture fixture = setup();
        new TransactionTemplate(transactionManager).executeWithoutResult(tx ->
                assertTrue(decisions.findByIdAndRoomIdForUpdate(fixture.decisionId(), -1L).isEmpty()));
        verifyNoInteractions(broker);
    }

    @ParameterizedTest
    @EnumSource(WriteCommand.class)
    void closeTakingTheRoomLockFirstRejectsTheWaitingDecisionWrite(WriteCommand command) throws Exception {
        Fixture fixture = setup();
        runInOrder(() -> roomService.closeRoom(fixture.slug(), "host"),
                () -> write(fixture, command), true);

        assertEquals(RoomStatus.CLOSED, rooms.findById(fixture.roomId()).orElseThrow().getRoomStatus());
        assertEquals(1, decisions.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals(DecisionStatus.PROPOSED, decisions.findById(fixture.decisionId()).orElseThrow().getStatus());
        assertTrue(confirmations.findAllByDecisionId(fixture.decisionId()).isEmpty());
        assertEquals(1, closeEvents.events.size());
        verify(roomCache).evict(fixture.slug());
        verifyNoInteractions(broker);
    }

    @ParameterizedTest
    @EnumSource(WriteCommand.class)
    void decisionWriteTakingTheRoomLockFirstCommitsBeforeClose(WriteCommand command) throws Exception {
        Fixture fixture = setup();
        runInOrder(() -> write(fixture, command),
                () -> roomService.closeRoom(fixture.slug(), "host"), false);

        assertEquals(RoomStatus.CLOSED, rooms.findById(fixture.roomId()).orElseThrow().getRoomStatus());
        assertEquals(command == WriteCommand.CREATE ? 2 : 1,
                decisions.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals(command == WriteCommand.VOTE ? 1 : 0,
                confirmations.findAllByDecisionId(fixture.decisionId()).size());
        assertEquals(command == WriteCommand.UPDATE ? DecisionStatus.CONFIRMED : DecisionStatus.PROPOSED,
                decisions.findById(fixture.decisionId()).orElseThrow().getStatus());
        assertEquals(1, closeEvents.events.size());
        verify(roomCache).evict(fixture.slug());
        verify(broker).convertAndSend(eq("/topic/room." + fixture.slug() + ".decisions"), any(Object.class));
    }

    @Test
    void repeatedConcurrentCloseIsSuccessfulAndEmitsOnlyOneEvent() throws Exception {
        Fixture fixture = setup();
        concurrently(index -> roomService.closeRoom(fixture.slug(), "host"));
        Room closed = rooms.findById(fixture.roomId()).orElseThrow();
        assertEquals(RoomStatus.CLOSED, closed.getRoomStatus());
        assertNotNull(closed.getClosedAt());
        Instant closedAt = closed.getClosedAt();
        roomService.closeRoom(fixture.slug(), "host");
        assertEquals(closedAt, rooms.findById(fixture.roomId()).orElseThrow().getClosedAt());
        assertEquals(1, closeEvents.events.size());
        verify(roomCache, times(1)).evict(fixture.slug());
        verifyNoInteractions(broker);
    }

    private void write(Fixture fixture, WriteCommand command) {
        switch (command) {
            case CREATE -> service.createDecision(fixture.slug(), "guest", CreateDecisionRequest.builder()
                    .text("A new proposal").proposeImmediately(true).build());
            case VOTE -> service.confirmDecision(fixture.slug(), fixture.decisionId(), "guest",
                    ConfirmDecisionRequest.builder().choice(ConfirmationChoice.APPROVE).build());
            case UPDATE -> service.updateDecisionStatus(fixture.slug(), fixture.decisionId(), "host",
                    UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build());
        }
    }

    private void runInOrder(Runnable first, Runnable second, boolean secondRejected) throws Exception {
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> holder = executor.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                first.run();
                locked.countDown();
                await(release);
            }));
            try {
                assertTrue(locked.await(10, TimeUnit.SECONDS));
                Future<?> waiter = executor.submit(() -> {
                    secondStarted.countDown();
                    second.run();
                });
                assertTrue(secondStarted.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> waiter.get(200, TimeUnit.MILLISECONDS));
                release.countDown();
                holder.get(15, TimeUnit.SECONDS);
                if (secondRejected) {
                    var error = assertThrows(ExecutionException.class, () -> waiter.get(15, TimeUnit.SECONDS));
                    assertInstanceOf(IllegalArgumentException.class, error.getCause());
                } else {
                    waiter.get(15, TimeUnit.SECONDS);
                }
            } finally {
                release.countDown();
            }
        }
    }

    private Fixture setup() {
        return new TransactionTemplate(transactionManager).execute(tx -> {
            Room room = rooms.save(Room.builder().slug(UUID.randomUUID().toString().substring(0, 12))
                    .title("Concurrency test").hostTokenHash(TokenUtil.sha256("host"))
                    .expiresAt(Instant.now().plusSeconds(3600)).build());
            RoomSession guest = sessions.save(RoomSession.builder().room(room)
                    .guestId(UUID.randomUUID().toString()).nickname("Guest")
                    .sessionTokenHash(TokenUtil.sha256("guest")).build());
            Decision decision = decisions.save(Decision.builder().room(room).createdBy(guest)
                    .text("Choose A").status(DecisionStatus.PROPOSED).evidenceRefs("[]").build());
            return new Fixture(room.getSlug(), room.getId(), decision.getId());
        });
    }

    private void concurrently(IntConsumer action) throws Exception {
        CountDownLatch ready = new CountDownLatch(8);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(8)) {
            List<Future<?>> futures = new ArrayList<>();
            for (int index = 0; index < 8; index++) {
                int caller = index;
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    await(start);
                    action.accept(caller);
                }));
            }
            try {
                assertTrue(ready.await(10, TimeUnit.SECONDS));
            } finally {
                start.countDown();
            }
            for (Future<?> future : futures) future.get(15, TimeUnit.SECONDS);
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Timed out waiting for test coordination");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(error);
        }
    }

    private static final class Fixture {
        private final String slug;
        private final Long roomId;
        private final Long decisionId;

        private Fixture(String slug, Long roomId, Long decisionId) {
            this.slug = slug;
            this.roomId = roomId;
            this.decisionId = decisionId;
        }

        private String slug() { return slug; }
        private Long roomId() { return roomId; }
        private Long decisionId() { return decisionId; }
    }
}
