package com.eventchat.modules.room.service.impl;

import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomRetentionService;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.common.util.TokenUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(RoomRetentionServiceImpl.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RoomRetentionTest {
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired RoomRetentionService retention;
    @Autowired PlatformTransactionManager transactions;
    @MockBean MessageRepository messages;
    @MockBean StringRedisTemplate redis;
    @Autowired com.eventchat.modules.attachment.repository.AttachmentRepository attachments;
    @Autowired com.eventchat.modules.attachment.repository.AttachmentDeleteTaskRepository deleteTasks;

    private Room fixture(long expiredSecondsAgo) {
        return new TransactionTemplate(transactions).execute(tx -> {
            var room = rooms.save(Room.builder().slug(UUID.randomUUID().toString().substring(0,12)).title("Retention")
                    .hostTokenHash(TokenUtil.sha256("host")).expiresAt(Instant.now().minusSeconds(expiredSecondsAgo)).build());
            sessions.save(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                    .nickname("Host").sessionTokenHash(TokenUtil.sha256("session")).build());
            return room;
        });
    }
    @Test void purgesOnlyAfterSevenDaysAndCanBeRetried() {
        var room = fixture(8 * 86400);
        assertTrue(retention.purge(room.getSlug()));
        assertFalse(rooms.existsById(room.getId()));
        assertEquals(0, sessions.countByRoomId(room.getId()));
        verify(messages).deleteByRoomId(room.getId());
        verify(redis).delete(anyCollection());
        assertFalse(retention.purge(room.getSlug()));
    }
    @Test void retainsDataInsideGracePeriod() {
        var room = fixture(6 * 86400);
        assertFalse(retention.purge(room.getSlug()));
        assertTrue(rooms.existsById(room.getId()));
        verifyNoInteractions(messages, redis);
    }
    @Test void mongoFailurePreservesSqlAndCachesForRetry() {
        var room = fixture(8 * 86400);
        doThrow(new IllegalStateException("Mongo offline")).when(messages).deleteByRoomId(room.getId());
        assertThrows(IllegalStateException.class, () -> retention.purge(room.getSlug()));
        assertTrue(rooms.existsById(room.getId()));
        assertEquals(1, sessions.countByRoomId(room.getId()));
        verifyNoInteractions(redis);
    }

    @Test void purgingRoomPreservesDurableFileDeletionTasksOutsideRoomForeignKeys() {
        Room room = fixture(8 * 86400);
        String key = UUID.randomUUID().toString();
        attachments.saveAndFlush(com.eventchat.modules.attachment.entity.Attachment.builder()
                .room(room).publicId(UUID.randomUUID().toString()).uploaderSessionId(1L)
                .clientUploadId(UUID.randomUUID().toString()).originalFilename("notes.txt")
                .declaredContentType("text/plain").expectedSizeBytes(5).storageKey(key)
                .uploadExpiresAt(Instant.now().minusSeconds(1)).expiresAt(Instant.now().minusSeconds(1)).build());
        assertTrue(retention.purge(room.getSlug()));
        assertFalse(rooms.existsById(room.getId()));
        assertTrue(deleteTasks.findByStorageKey(key).isPresent());
    }
}
