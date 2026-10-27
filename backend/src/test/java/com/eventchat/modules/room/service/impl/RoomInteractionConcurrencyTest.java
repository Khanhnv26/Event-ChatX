package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.chat.service.SequenceGenerator;
import com.eventchat.modules.chat.service.impl.ChatServiceImpl;
import com.eventchat.modules.interaction.poll.dto.request.*;
import com.eventchat.modules.interaction.poll.repository.PollRepository;
import com.eventchat.modules.interaction.poll.service.impl.PollServiceImpl;
import com.eventchat.modules.interaction.wheel.dto.request.*;
import com.eventchat.modules.interaction.wheel.repository.*;
import com.eventchat.modules.interaction.wheel.service.impl.WheelServiceImpl;
import com.eventchat.modules.room.cache.*;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.*;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import({RoomServiceImpl.class, PollServiceImpl.class, WheelServiceImpl.class,
        ChatServiceImpl.class, RoomInteractionConcurrencyTest.JsonConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RoomInteractionConcurrencyTest {
    @Autowired RoomServiceImpl roomsService;
    @Autowired PollServiceImpl pollsService;
    @Autowired WheelServiceImpl wheelsService;
    @Autowired ChatServiceImpl chat;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired PollRepository polls;
    @Autowired WheelRepository wheels;
    @Autowired WheelSpinRepository spins;
    @Autowired PlatformTransactionManager transactions;
    @MockBean RoomCacheService roomCache;
    @MockBean SessionCacheService sessionCache;
    @MockBean MessageRepository messages;
    @MockBean SequenceGenerator sequence;
    @MockBean SimpMessagingTemplate broker;

    @TestConfiguration
    static class JsonConfig {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
    }

    enum Write { CREATE_POLL, VOTE, CLOSE_POLL, CREATE_WHEEL, SPIN, CHAT }

    @ParameterizedTest
    @EnumSource(Write.class)
    void closeBeforeWriteRejectsTheWaitingInteraction(Write command) throws Exception {
        Fixture fixture = setup();
        ordered(() -> roomsService.closeRoom(fixture.slug(), "host"), () -> write(fixture, command), true);
        assertEquals(RoomStatus.CLOSED, rooms.findById(fixture.roomId()).orElseThrow().getRoomStatus());
        assertEquals(1, polls.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals(1, wheels.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertTrue(spins.findAllByWheelIdOrderByCreatedAtDesc(fixture.wheelId()).isEmpty());
        verify(messages, never()).save(any());
        verifyNoInteractions(broker);
    }

    @ParameterizedTest
    @EnumSource(Write.class)
    void writeBeforeCloseCommitsBeforeTheRoomCloses(Write command) throws Exception {
        Fixture fixture = setup();
        ordered(() -> write(fixture, command), () -> roomsService.closeRoom(fixture.slug(), "host"), false);
        assertEquals(RoomStatus.CLOSED, rooms.findById(fixture.roomId()).orElseThrow().getRoomStatus());
        assertEquals(command == Write.CREATE_POLL ? 2 : 1,
                polls.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals(command == Write.CREATE_WHEEL ? 2 : 1,
                wheels.findAllByRoomIdOrderByCreatedAtDesc(fixture.roomId()).size());
        assertEquals(command == Write.SPIN ? 1 : 0,
                spins.findAllByWheelIdOrderByCreatedAtDesc(fixture.wheelId()).size());
        if (command == Write.CHAT) verify(messages).save(any(Message.class));
        else verify(messages, never()).save(any());
    }

    private Fixture setup() {
        Room room = new TransactionTemplate(transactions).execute(tx -> {
            Room saved = rooms.save(Room.builder().slug(UUID.randomUUID().toString().substring(0, 12))
                    .title("Room locking test").hostTokenHash(TokenUtil.sha256("host"))
                    .expiresAt(Instant.now().plusSeconds(3600)).build());
            sessions.save(RoomSession.builder().room(saved).guestId(UUID.randomUUID().toString())
                    .nickname("Host").role(SessionRole.HOST).sessionTokenHash(TokenUtil.sha256("session")).build());
            return saved;
        });
        var poll = pollsService.createPoll(room.getSlug(), "session", CreatePollRequest.builder()
                .question("Choose").options(List.of("A", "B")).build());
        var wheel = wheelsService.createWheel(room.getSlug(), "session", CreateWheelRequest.builder()
                .title("Choose").entries(List.of("A", "B")).build());
        when(roomCache.getBySlug(room.getSlug())).thenReturn(RoomSnapshot.builder().id(room.getId())
                .slug(room.getSlug()).status(RoomStatus.ACTIVE).expiresAt(room.getExpiresAt()).build());
        when(sessionCache.getByToken(eq(room.getSlug()), eq(room.getId()), anyString()))
                .thenReturn(SessionSnapshot.builder().roomId(room.getId()).sessionId(1L).guestId("guest")
                        .nickname("Host").role(SessionRole.HOST).build());
        when(sequence.next(eq(room.getId()), any())).thenReturn(1L);
        when(messages.save(any(Message.class))).thenAnswer(call -> {
            Message message = call.getArgument(0);
            message.setId("server-id");
            return message;
        });
        clearInvocations(broker, messages, roomCache);
        return new Fixture(room.getSlug(), room.getId(), poll.getId(), poll.getOptions().getFirst().getId(), wheel.getId());
    }

    private void write(Fixture fixture, Write command) {
        switch (command) {
            case CREATE_POLL -> pollsService.createPoll(fixture.slug(), "session", CreatePollRequest.builder()
                    .question("Another poll").options(List.of("A", "B")).build());
            case VOTE -> pollsService.castVote(fixture.slug(), fixture.pollId(), "session",
                    CastVoteRequest.builder().optionId(fixture.optionId()).build());
            case CLOSE_POLL -> pollsService.closePoll(fixture.slug(), fixture.pollId(), "host");
            case CREATE_WHEEL -> wheelsService.createWheel(fixture.slug(), "session", CreateWheelRequest.builder()
                    .title("Another wheel").entries(List.of("A", "B")).build());
            case SPIN -> wheelsService.spinWheel(fixture.slug(), fixture.wheelId(), "session",
                    SpinWheelRequest.builder().idempotencyKey("spin-once").build());
            case CHAT -> chat.sendMessage(fixture.slug(), "session", SendMessageRequest.builder()
                    .clientMessageId("chat-once").body("Hello").build());
        }
    }

    private void ordered(Runnable first, Runnable second, boolean rejectSecond) throws Exception {
        CountDownLatch firstDone = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> holder = executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                first.run();
                firstDone.countDown();
                await(release);
            }));
            try {
                assertTrue(firstDone.await(10, TimeUnit.SECONDS));
                Future<?> waiter = executor.submit(() -> { secondStarted.countDown(); second.run(); });
                assertTrue(secondStarted.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> waiter.get(200, TimeUnit.MILLISECONDS));
                release.countDown();
                holder.get(15, TimeUnit.SECONDS);
                if (rejectSecond) {
                    var error = assertThrows(ExecutionException.class, () -> waiter.get(15, TimeUnit.SECONDS));
                    assertInstanceOf(IllegalArgumentException.class, error.getCause());
                } else waiter.get(15, TimeUnit.SECONDS);
            } finally { release.countDown(); }
        }
    }

    private static void await(CountDownLatch latch) {
        try { assertTrue(latch.await(10, TimeUnit.SECONDS)); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
    }

    private static final class Fixture {
        private final String slug;
        private final Long roomId;
        private final Long pollId;
        private final Long optionId;
        private final Long wheelId;

        private Fixture(String slug, Long roomId, Long pollId, Long optionId, Long wheelId) {
            this.slug = slug;
            this.roomId = roomId;
            this.pollId = pollId;
            this.optionId = optionId;
            this.wheelId = wheelId;
        }

        private String slug() { return slug; }
        private Long roomId() { return roomId; }
        private Long pollId() { return pollId; }
        private Long optionId() { return optionId; }
        private Long wheelId() { return wheelId; }
    }
}
