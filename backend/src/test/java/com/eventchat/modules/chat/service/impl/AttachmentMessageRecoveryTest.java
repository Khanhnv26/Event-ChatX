package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.service.impl.AttachmentLinkService;
import com.eventchat.modules.chat.entity.*;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.annotation.*;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ContextConfiguration(classes = AttachmentMessageRecoveryTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AttachmentMessageRecoveryTest {
    @Configuration
    @EntityScan(basePackageClasses = {Attachment.class, Room.class})
    @EnableJpaRepositories(basePackageClasses = {AttachmentRepository.class, RoomRepository.class})
    @Import({AttachmentLinkService.class, AttachmentMessageRecovery.class})
    static class Config {}
    @Autowired AttachmentMessageRecovery recovery;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired AttachmentRepository attachments;
    @SpyBean AttachmentLinkService links;
    @MockBean MessageRepository messages;
    @MockBean SimpMessagingTemplate broker;
    private Room room;
    private RoomSession owner;
    private Attachment file;
    private Message pending;

    @BeforeEach void setup() {
        room = rooms.saveAndFlush(Room.builder().slug(UUID.randomUUID().toString().substring(0, 8)).title("Recovery")
                .hostTokenHash("a".repeat(64)).expiresAt(Instant.now().plusSeconds(3600)).build());
        owner = sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .nickname("Owner").sessionTokenHash(TokenUtil.sha256(UUID.randomUUID().toString())).build());
        file = attachments.saveAndFlush(Attachment.builder().publicId(UUID.randomUUID().toString()).room(room)
                .uploaderSessionId(owner.getId()).clientUploadId(UUID.randomUUID().toString()).originalFilename("notes.txt")
                .declaredContentType("text/plain").expectedSizeBytes(5).state(AttachmentState.READY)
                .uploadExpiresAt(Instant.now().plusSeconds(3600)).expiresAt(Instant.now().plusSeconds(3600)).build());
        pending = Message.builder().id(UUID.randomUUID().toString()).roomId(room.getId()).clientMessageId(UUID.randomUUID().toString())
                .sequence(1L).body("").sender(SenderInfo.builder().sessionId(owner.getId()).guestId(owner.getGuestId()).nickname("Owner").build())
                .attachments(List.of(AttachmentResponse.builder().publicId(file.getPublicId()).filename("notes.txt").build()))
                .attachmentLinkPending(true).createdAt(Instant.now()).expiresAt(room.getExpiresAt().plusSeconds(604800)).build();
        when(messages.findTop25ByAttachmentLinkPendingTrueOrderByCreatedAtAsc()).thenReturn(List.of(pending));
    }

    @Test void recoversMongoMessageWhoseSqlBindingWasRolledBack() {
        recovery.recover();
        Attachment linked = attachments.findById(file.getId()).orElseThrow();
        assertThat(linked.getState()).isEqualTo(AttachmentState.LINKED);
        assertThat(linked.getBoundClientMessageId()).isEqualTo(pending.getClientMessageId());
        assertThat(pending.isAttachmentLinkPending()).isFalse();
        verify(messages).save(pending);
        verify(broker).convertAndSend(eq("/topic/room." + room.getSlug() + ".messages"), any(Object.class));
    }

    @Test void sqlFailureKeepsMessagePendingAndDoesNotBroadcast() {
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new DataIntegrityViolationException("Injected SQL failure");
        }).when(links).bind(anyLong(), anyLong(), anyString(), anyList(), any());
        recovery.recover();
        assertThat(attachments.findById(file.getId()).orElseThrow().getState()).isEqualTo(AttachmentState.READY);
        assertThat(pending.isAttachmentLinkPending()).isTrue();
        verify(messages, never()).save(any()); verifyNoInteractions(broker);
    }

    @Test void revokedUploaderCannotRecoverAnUncommittedMessage() {
        owner.setRevokedAt(Instant.now()); sessions.saveAndFlush(owner);
        recovery.recover();
        assertThat(attachments.findById(file.getId()).orElseThrow().getState()).isEqualTo(AttachmentState.READY);
        assertThat(pending.isAttachmentLinkPending()).isFalse();
        verifyNoInteractions(broker);
    }

    @Test void closedRoomDoesNotPublishAbandonedMessage() {
        room.setRoomStatus(RoomStatus.CLOSED); rooms.saveAndFlush(room);
        recovery.recover();
        assertThat(attachments.findById(file.getId()).orElseThrow().getState()).isEqualTo(AttachmentState.READY);
        assertThat(pending.isAttachmentLinkPending()).isFalse();
        verifyNoInteractions(broker);
    }
}
