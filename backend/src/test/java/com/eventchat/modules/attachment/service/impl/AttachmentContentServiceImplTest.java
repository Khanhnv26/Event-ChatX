package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentStorageException;
import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.infrastructure.storage.service.impl.StorageServiceImpl;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadContentResponse;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentDeleteTaskRepository;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.repository.RoomAttachmentQuotaRepository;
import com.eventchat.modules.attachment.service.AttachmentContentService;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ContextConfiguration(classes = AttachmentContentServiceImplTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AttachmentContentServiceImplTest {
    @TempDir static Path storageRoot;

    @DynamicPropertySource
    static void configureStorage(DynamicPropertyRegistry registry) {
        registry.add("app.upload.storage.root", () -> storageRoot.toString());
    }

    @Configuration
    @EntityScan(basePackageClasses = {Attachment.class, Room.class})
    @EnableJpaRepositories(basePackageClasses = {AttachmentRepository.class, RoomRepository.class})
    @EnableConfigurationProperties({AttachmentProperties.class, StorageProperties.class})
    @Import({AttachmentServiceImpl.class, AttachmentContentServiceImpl.class})
    static class Config {
        @Bean StorageService storage(StorageProperties properties) throws IOException {
            return new StorageServiceImpl(properties);
        }
    }

    @Autowired AttachmentContentService content;
    @Autowired AttachmentService intents;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired AttachmentDeleteTaskRepository deleteTasks;
    @Autowired RoomAttachmentQuotaRepository quotas;
    @SpyBean AttachmentRepository attachments;
    @SpyBean StorageService storage;
    private Room room;
    private RoomSession owner;
    private String token;
    private String publicId;

    @BeforeEach
    void createIntent() {
        room = rooms.saveAndFlush(Room.builder().slug(UUID.randomUUID().toString().substring(0, 8))
                .title("Upload test").hostTokenHash("a".repeat(64))
                .expiresAt(Instant.now().plusSeconds(3600)).build());
        token = UUID.randomUUID().toString();
        owner = sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .sessionTokenHash(TokenUtil.sha256(token)).nickname("Uploader").build());
        publicId = newIntent();
    }

    @Test
    void streamsWithoutDatabaseTransactionAndStoresBytesHashAndProcessingState() throws Exception {
        InputStream input = new ByteArrayInputStream(new byte[]{1, 2, 3}) {
            @Override public synchronized int read(byte[] buffer, int offset, int length) {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                assertThat(attachment().getState()).isEqualTo(AttachmentState.UPLOADING);
                assertThat(attachment().getStorageKey()).isNotBlank();
                return super.read(buffer, offset, length);
            }
        };
        UploadContentResponse response = content.upload(room.getSlug(), token, publicId, 3, input);
        Attachment stored = attachment();
        assertThat(response.getState()).isEqualTo(AttachmentState.PROCESSING);
        assertThat(stored.getActualSizeBytes()).isEqualTo(3);
        assertThat(stored.getSha256()).isEqualTo("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
        assertThat(Files.readAllBytes(storageRoot.resolve(stored.getStorageKey()))).containsExactly(1, 2, 3);
        assertThat(quotas.findById(room.getId()).orElseThrow().getReservedBytes()).isEqualTo(3);
        assertThat(stored.getChargedBytes()).isZero();
    }

    @Test
    void rejectsAnotherMemberAndAnotherRoomWithoutWritingStorage() {
        String otherToken = "other-" + UUID.randomUUID();
        sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .sessionTokenHash(TokenUtil.sha256(otherToken)).nickname("Other").build());
        assertThatThrownBy(() -> content.upload(room.getSlug(), otherToken, publicId, 3, bytes(3)))
                .isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> content.upload("another-room", token, publicId, 3, bytes(3)))
                .isInstanceOf(SecurityException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsMissingAndRevokedSessions() {
        assertThatThrownBy(() -> content.upload(room.getSlug(), null, publicId, 3, bytes(3)))
                .isInstanceOf(SecurityException.class);
        owner.setRevokedAt(Instant.now());
        sessions.saveAndFlush(owner);
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                .isInstanceOf(SecurityException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsExpiredIntentBeforeReading() {
        Attachment attachment = attachment();
        attachment.setUploadExpiresAt(Instant.now().minusSeconds(1));
        attachments.saveAndFlush(attachment);
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                .isInstanceOf(AttachmentConflictException.class);
        verifyNoInteractions(storage);
    }

    @ParameterizedTest
    @EnumSource(value = AttachmentState.class, names = {"UPLOADING", "PROCESSING", "READY", "LINKED", "REJECTED"})
    void refusesToOverwriteExistingOrTerminalUploads(AttachmentState state) {
        Attachment attachment = attachment();
        attachment.setState(state);
        attachments.saveAndFlush(attachment);
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                .isInstanceOf(AttachmentConflictException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsIncorrectDeclaredLengthBeforeReading() {
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 4, bytes(4)))
                .isInstanceOf(UploadTooLargeException.class);
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 2, bytes(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(attachment().getState()).isEqualTo(AttachmentState.RESERVED);
        verifyNoInteractions(storage);
    }

    @Test
    void measuresChunkedBodyAndAllowsRetryAfterTooFewOrTooManyBytes() throws Exception {
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, -1, bytes(4)))
                .isInstanceOf(UploadTooLargeException.class);
        assertThat(attachment().getState()).isEqualTo(AttachmentState.RESERVED);
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, -1, bytes(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(attachment().getStorageKey()).isNull();
        assertThat(content.upload(room.getSlug(), token, publicId, -1, bytes(3)).getState())
                .isEqualTo(AttachmentState.PROCESSING);
    }

    @Test
    void streamFailureRestoresReservationAndDoesNotLeakPartialFile() throws Exception {
        InputStream broken = new InputStream() {
            @Override public int read() throws IOException { throw new IOException("Disconnected"); }
        };
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, -1, broken))
                .isInstanceOf(AttachmentStorageException.class);
        assertThat(attachment().getState()).isEqualTo(AttachmentState.RESERVED);
        assertThat(attachment().getStorageKey()).isNull();
    }

    @Test
    void failedPhysicalDeletionKeepsKeyAndDurableDeletionTask() throws Exception {
        doThrow(new IOException("Storage unavailable")).when(storage).delete(anyString());
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, -1, bytes(2)))
                .isInstanceOf(IllegalArgumentException.class);
        Attachment failed = attachment();
        assertThat(failed.getState()).isEqualTo(AttachmentState.UPLOADING);
        assertThat(failed.getStorageKey()).isNotBlank();
        assertThat(deleteTasks.findByStorageKey(failed.getStorageKey())).isPresent();
    }

    @Test
    void databaseFailureAfterWritingBytesDeletesObjectAndRestoresReservation() {
        doThrow(new DataIntegrityViolationException("Injected failure")).when(attachments)
                .saveAndFlush(argThat(attachment -> attachment != null
                        && attachment.getState() == AttachmentState.PROCESSING));
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(attachment().getState()).isEqualTo(AttachmentState.RESERVED);
        assertThat(attachment().getStorageKey()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"closed", "revoked", "expired"})
    void accessLostDuringStreamingCannotBecomeProcessing(String reason) {
        InputStream input = new ByteArrayInputStream(new byte[]{1, 2, 3}) {
            @Override public synchronized int read(byte[] buffer, int offset, int length) {
                if (reason.equals("revoked")) {
                    owner.setRevokedAt(Instant.now());
                    sessions.saveAndFlush(owner);
                } else if (reason.equals("closed")) {
                    room.setRoomStatus(RoomStatus.CLOSED);
                    rooms.saveAndFlush(room);
                } else {
                    Attachment attachment = attachment();
                    attachment.setUploadExpiresAt(Instant.now().minusSeconds(1));
                    attachments.saveAndFlush(attachment);
                }
                return super.read(buffer, offset, length);
            }
        };
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, input))
                .isInstanceOf(reason.equals("revoked") ? SecurityException.class : AttachmentConflictException.class);
        assertThat(attachment().getState()).isEqualTo(AttachmentState.RESERVED);
    }

    @Test
    void twoConcurrentPutsOfSameIntentOnlyWriteOnce() throws Exception {
        CountDownLatch reading = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        InputStream blocking = new ByteArrayInputStream(new byte[]{1, 2, 3}) {
            @Override public synchronized int read(byte[] buffer, int offset, int length) {
                reading.countDown();
                try {
                    if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out");
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
                return super.read(buffer, offset, length);
            }
        };
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<UploadContentResponse> first = executor.submit(() -> content.upload(room.getSlug(), token, publicId, 3, blocking));
            assertThat(reading.await(10, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                    .isInstanceOf(AttachmentConflictException.class);
            release.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).getState()).isEqualTo(AttachmentState.PROCESSING);
            verify(storage, times(1)).put(anyString(), any(InputStream.class), eq(3L));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void sessionCannotClaimThirdConcurrentUpload() {
        for (int index = 0; index < 2; index++) {
            String id = newIntent();
            Attachment attachment = attachments.findByRoom_IdAndPublicId(room.getId(), id).orElseThrow();
            attachment.setState(AttachmentState.UPLOADING);
            attachments.saveAndFlush(attachment);
        }
        assertThatThrownBy(() -> content.upload(room.getSlug(), token, publicId, 3, bytes(3)))
                .isInstanceOf(AttachmentConflictException.class);
        verifyNoInteractions(storage);
    }

    private String newIntent() {
        CreateUploadIntentRequest request = new CreateUploadIntentRequest();
        request.setClientUploadId(UUID.randomUUID().toString());
        request.setFilename("notes.txt");
        request.setDeclaredContentType("text/plain");
        request.setSizeBytes(3L);
        UploadIntentResponse response = intents.createIntent(room.getSlug(), token, request);
        return response.getPublicId();
    }

    private Attachment attachment() {
        return attachments.findByRoom_IdAndPublicId(room.getId(), publicId).orElseThrow();
    }

    private InputStream bytes(int size) {
        return new ByteArrayInputStream(new byte[size]);
    }
}
