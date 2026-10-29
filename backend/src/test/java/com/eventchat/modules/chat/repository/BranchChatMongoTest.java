package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.Message;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.util.*;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

// Use only a disposable Mongo instance; the test always selects a fresh database.
@DataMongoTest
@EnabledIfEnvironmentVariable(named = "EVENTCHAT_BRANCH_MONGO_URI", matches = ".+")
class BranchChatMongoTest {
    static final String DATABASE = "branch_chat_test_" + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> System.getenv("EVENTCHAT_BRANCH_MONGO_URI"));
        registry.add("spring.data.mongodb.database", () -> DATABASE);
        registry.add("spring.data.mongodb.auto-index-creation", () -> "true");
    }
    @Autowired MessageRepository messages;
    @Autowired MongoTemplate mongo;
    @BeforeEach void clear() { messages.deleteAll(); }

    @Test void directoryGroupsBeforeApplyingCursorAndFindsObjectIdRootsOutsideRecentTimeline() {
        var root = messages.save(Message.builder().roomId(1L).clientMessageId("old-root").sequence(1L).body("Old topic").build());
        for (int i = 2; i <= 60; i++) messages.save(Message.builder().roomId(1L).clientMessageId("main-" + i).sequence((long) i).build());
        messages.save(Message.builder().roomId(1L).clientMessageId("a").threadRootId(root.getId()).sequence(61L).body("Older reply").createdAt(Instant.parse("2026-10-29T06:00:00Z")).build());
        messages.save(Message.builder().roomId(1L).clientMessageId("b").threadRootId("other-root").sequence(62L).body("Other topic").build());
        messages.save(Message.builder().roomId(1L).clientMessageId("c").threadRootId(root.getId()).sequence(63L).body("Newest reply").createdAt(Instant.parse("2026-10-29T07:00:00Z")).build());
        messages.save(Message.builder().roomId(2L).clientMessageId("foreign").threadRootId(root.getId()).sequence(100L).build());
        assertFalse(messages.findByRoomIdOrderBySequenceDesc(1L, PageRequest.of(0, 50)).stream().anyMatch(m -> m.getId().equals(root.getId())));
        var first = messages.findThreadActivities(1L, Long.MAX_VALUE);
        assertEquals(List.of(root.getId(), "other-root"), first.stream().map(ThreadActivity::getId).toList());
        assertEquals(2, first.getFirst().getReplyCount());
        assertEquals("Newest reply", first.getFirst().getLastReplySnippet());
        assertEquals(List.of("other-root"), messages.findThreadActivities(1L, 63L).stream().map(ThreadActivity::getId).toList());
        assertEquals(root.getId(), messages.findByRoomIdAndIdIn(1L, List.of(root.getId())).getFirst().getId());
        assertTrue(messages.findByRoomIdAndIdIn(2L, List.of(root.getId())).isEmpty());
    }

    @Test void mainQueriesIncludeLegacyMissingFieldsAndExcludeAllBranchReplies() {
        mongo.getCollection("messages").insertOne(new Document("_id", "legacy").append("roomId", 1L)
                .append("clientMessageId", "legacy-client").append("sequence", 1L));
        messages.save(Message.builder().id("root").roomId(1L).clientMessageId("root-client").sequence(2L).build());
        messages.save(Message.builder().id("reply").roomId(1L).threadRootId("root").clientMessageId("reply-client").sequence(3L).build());
        assertEquals(List.of("root", "legacy"), messages.findByRoomIdOrderBySequenceDesc(1L, PageRequest.of(0, 50)).stream().map(Message::getId).toList());
        assertEquals(List.of("legacy", "root"), messages.findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(1L, 0L, PageRequest.of(0, 100)).stream().map(Message::getId).toList());
    }
    @Test void threadQueriesAndAggregationStayWithinRoomAndRoot() {
        for (int i = 1; i <= 105; i++) messages.save(Message.builder().id("r" + i).roomId(1L)
                .clientMessageId("c" + i).sequence((long) i).threadRootId("root").body("Reply").build());
        messages.save(Message.builder().id("other-room").roomId(2L).clientMessageId("other").sequence(1L).threadRootId("root").build());
        messages.save(Message.builder().id("other-thread").roomId(1L).clientMessageId("other-thread").sequence(106L).threadRootId("another").build());
        var page = messages.findByRoomIdAndThreadRootIdAndSequenceGreaterThanOrderBySequenceAsc(1L, "root", 100L, PageRequest.of(0, 101));
        assertEquals(List.of(101L, 102L, 103L, 104L, 105L), page.stream().map(Message::getSequence).toList());
        var counts = messages.countThreadReplies(1L, List.of("root", "another"));
        assertEquals(105, counts.stream().filter(c -> c.getId().equals("root")).findFirst().orElseThrow().getCount());
        assertEquals(105, messages.countByRoomIdAndThreadRootId(1L, "root"));
        assertTrue(mongo.getCollection("messages").listIndexes().into(new ArrayList<>()).stream()
                .anyMatch(index -> index.getString("name").equals("idx_room_thread_seq")));
        messages.deleteByRoomId(1L);
        assertEquals(0, messages.countByRoomIdAndThreadRootId(1L, "root"));
        assertEquals(1, messages.countByRoomIdAndThreadRootId(2L, "root"));
    }
}
