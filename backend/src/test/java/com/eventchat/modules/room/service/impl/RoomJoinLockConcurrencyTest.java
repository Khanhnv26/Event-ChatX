package com.eventchat.modules.room.service.impl;

import com.eventchat.common.exception.RoomJoinLockedException;
import com.eventchat.modules.room.dto.request.*;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomCacheService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(RoomServiceImpl.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RoomJoinLockConcurrencyTest {
    @Autowired RoomServiceImpl service;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired PlatformTransactionManager transactions;
    @MockBean RoomCacheService cache;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void joinAndLockSerializeOnTheSameRoomRow(boolean lockFirst) throws Exception {
        var host = service.createRoom(CreateRoomRequest.builder().title("Join lock race")
                .hostNickname("Host").ttlMinutes(60).build());
        Long id = rooms.findBySlug(host.getSlug()).orElseThrow().getId();
        Runnable lock = () -> service.updateJoinLock(host.getSlug(), host.getHostToken(), true);
        Runnable join = () -> service.joinRoom(host.getSlug(), JoinRoomRequest.builder().nickname("Guest").build());
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch started = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> holder = executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                (lockFirst ? lock : join).run();
                held.countDown();
                try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            }));
            try {
                assertTrue(held.await(10, TimeUnit.SECONDS));
                Future<?> waiter = executor.submit(() -> {
                    started.countDown();
                    (lockFirst ? join : lock).run();
                });
                assertTrue(started.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> waiter.get(200, TimeUnit.MILLISECONDS));
                release.countDown();
                holder.get(15, TimeUnit.SECONDS);
                if (lockFirst) {
                    ExecutionException error = assertThrows(ExecutionException.class, () -> waiter.get(15, TimeUnit.SECONDS));
                    assertInstanceOf(RoomJoinLockedException.class, error.getCause());
                } else waiter.get(15, TimeUnit.SECONDS);
            } finally { release.countDown(); }
        }
        assertTrue(rooms.findById(id).orElseThrow().isJoinLocked());
        assertEquals(lockFirst ? 1 : 2, sessions.countByRoomId(id));
    }
}
