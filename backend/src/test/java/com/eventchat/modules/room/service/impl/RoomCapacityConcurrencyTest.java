package com.eventchat.modules.room.service.impl;

import com.eventchat.common.exception.RoomFullException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.dto.request.CreateRoomRequest;
import com.eventchat.modules.room.dto.request.JoinRoomRequest;
import com.eventchat.modules.room.dto.response.RoomAuthResponse;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomCacheService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(RoomServiceImpl.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RoomCapacityConcurrencyTest {
    @Autowired RoomServiceImpl service;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired PlatformTransactionManager transactions;
    @MockBean RoomCacheService cache;

    @Test
    void eightGuestsCompetingForTheLastSlotNeverExceedFiftySessions() throws Exception {
        RoomAuthResponse host = roomWithSessionCount(49);
        Long roomId = rooms.findBySlug(host.getSlug()).orElseThrow().getId();
        AtomicInteger accepted = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        CountDownLatch ready = new CountDownLatch(8);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(8)) {
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    try {
                        assertTrue(start.await(10, TimeUnit.SECONDS));
                        service.joinRoom(host.getSlug(), JoinRoomRequest.builder().nickname("Guest").build());
                        accepted.incrementAndGet();
                    } catch (RoomFullException expected) {
                        rejected.incrementAndGet();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(interrupted);
                    }
                }));
            }
            try { assertTrue(ready.await(10, TimeUnit.SECONDS)); }
            finally { start.countDown(); }
            for (Future<?> future : futures) future.get(15, TimeUnit.SECONDS);
        }
        assertEquals(1, accepted.get());
        assertEquals(7, rejected.get());
        assertEquals(50, sessions.countByRoomId(roomId));
    }

    @Test
    void hostOccupiesOneSlotAndCanReconnectEvenWhenRoomIsFull() {
        RoomAuthResponse host = roomWithSessionCount(50);
        Long roomId = rooms.findBySlug(host.getSlug()).orElseThrow().getId();
        RoomAuthResponse reconnected = service.reconnect(host.getSlug(), host.getSessionToken());
        assertEquals(host.getGuestId(), reconnected.getGuestId());
        assertEquals(50, sessions.countByRoomId(roomId));
        assertThrows(RoomFullException.class, () -> service.joinRoom(host.getSlug(),
                JoinRoomRequest.builder().nickname("Extra guest").build()));
    }

    private RoomAuthResponse roomWithSessionCount(int count) {
        RoomAuthResponse host = service.createRoom(CreateRoomRequest.builder().title("Capacity test")
                .hostNickname("Host").ttlMinutes(60).build());
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            var room = rooms.findBySlugForUpdate(host.getSlug()).orElseThrow();
            assertEquals(50, room.getMaxParticipants());
            assertEquals(1, sessions.countByRoomId(room.getId()));
            for (int i = 1; i < count; i++) {
                sessions.save(RoomSession.builder().room(room).nickname("Existing guest")
                        .guestId(UUID.randomUUID().toString()).sessionTokenHash(TokenUtil.sha256(UUID.randomUUID().toString())).build());
            }
        });
        return host;
    }
}
