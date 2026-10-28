package com.eventchat.modules.interaction.poll.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.interaction.poll.dto.request.*;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.repository.PollVoteRepository;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.IntConsumer;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(PollServiceImpl.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PollConcurrencyTest {
    @Autowired PollServiceImpl service;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired PollVoteRepository votes;
    @Autowired PlatformTransactionManager transactionManager;
    @MockBean SimpMessagingTemplate broker;

    @Test
    void concurrentSingleChoiceRequestsFromOneGuestCommitOnlyOneVote() throws Exception {
        String slug = setup();
        PollResponse poll = service.createPoll(slug, "token0", CreatePollRequest.builder()
                .question("Choose one").options(List.of("A", "B")).build());
        concurrently(index -> {
            try {
                service.castVote(slug, poll.getId(), "token0", CastVoteRequest.builder()
                        .optionId(poll.getOptions().get(index % 2).getId()).build());
            } catch (IllegalArgumentException alreadyVoted) {
                assertTrue(alreadyVoted.getMessage().contains("bỏ phiếu"));
            }
        });
        assertEquals(1, service.getPollsByRoom(slug).getFirst().getOptions().stream().mapToInt(o -> o.getVoteCount()).sum());
        assertEquals(1, votes.findAllByPollIdAndSessionId(poll.getId(),
                sessions.findByRoomIdAndSessionTokenHash(rooms.findBySlug(slug).orElseThrow().getId(),
                        TokenUtil.sha256("token0")).orElseThrow().getId()).size());
    }

    @Test
    void simultaneousGuestsDoNotLoseIncrements() throws Exception {
        String slug = setup();
        PollResponse poll = service.createPoll(slug, "token0", CreatePollRequest.builder()
                .question("Choose").options(List.of("A", "B")).build());
        concurrently(index -> service.castVote(slug, poll.getId(), "token" + index,
                CastVoteRequest.builder().optionId(poll.getOptions().getFirst().getId()).build()));
        assertEquals(8, service.getPollsByRoom(slug).getFirst().getOptions().stream().mapToInt(o -> o.getVoteCount()).sum());
    }

    private String setup() {
        String slug = UUID.randomUUID().toString().substring(0, 12);
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Room room = rooms.save(Room.builder().slug(slug).title("Test").hostTokenHash(TokenUtil.sha256("host"))
                    .expiresAt(Instant.now().plusSeconds(3600)).build());
            for (int index = 0; index < 8; index++) {
                sessions.save(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString()).nickname("Guest")
                        .sessionTokenHash(TokenUtil.sha256("token" + index))
                        .role(index == 0 ? com.eventchat.modules.room.enums.SessionRole.HOST : com.eventchat.modules.room.enums.SessionRole.PARTICIPANT).build());
            }
        });
        return slug;
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
                    try { assertTrue(start.await(10, TimeUnit.SECONDS)); }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
                    action.accept(caller);
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            for (Future<?> future : futures) future.get(15, TimeUnit.SECONDS);
        }
    }
}
