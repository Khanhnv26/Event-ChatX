package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.*;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.infrastructure.storage.service.impl.StorageServiceImpl;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.*;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ContextConfiguration(classes = MultipartAttachmentServiceTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MultipartAttachmentServiceTest {
    @TempDir static Path root;
    @DynamicPropertySource static void storageRoot(DynamicPropertyRegistry registry) {
        registry.add("app.upload.storage.root", () -> root.toString());
    }
    @Configuration
    @EntityScan(basePackageClasses = {Attachment.class, Room.class})
    @EnableJpaRepositories(basePackageClasses = {AttachmentRepository.class, RoomRepository.class})
    @EnableConfigurationProperties({AttachmentProperties.class, StorageProperties.class})
    @Import({AttachmentServiceImpl.class, AttachmentLifecycleService.class, AttachmentCleanupService.class, AttachmentLinkService.class})
    static class Config {
        @Bean StorageService storage(StorageProperties properties) throws IOException { return new StorageServiceImpl(properties); }
    }
    @Autowired AttachmentService service;
    @Autowired AttachmentCleanupService cleanup;
    @Autowired AttachmentLinkService links;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired RoomAttachmentQuotaRepository quotas;
    @Autowired AttachmentDeleteTaskRepository tasks;
    @Autowired AttachmentProperties properties;
    @Autowired PlatformTransactionManager transactions;
    @SpyBean AttachmentRepository attachments;
    @SpyBean StorageService storage;
    private Room room;
    private RoomSession owner;
    private String token;

    @BeforeEach void setup() {
        properties.setRoomQuotaBytes(200L * 1024 * 1024);
        room = rooms.saveAndFlush(Room.builder().slug(UUID.randomUUID().toString().substring(0, 8))
                .title("Multipart tests").hostTokenHash("a".repeat(64)).expiresAt(Instant.now().plusSeconds(3600)).build());
        token = UUID.randomUUID().toString();
        owner = session(token);
    }

    @Test void uploadChargesQuotaAndExpiresUnsentDraftWithin24Hours() throws Exception {
        AttachmentResponse response = upload();
        assertThat(response.getState()).isEqualTo(AttachmentState.READY);
        assertThat(response.getExpiresAt()).isBefore(Instant.now().plusSeconds(86401));
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isEqualTo(5);
        assertThat(attachment(response.getPublicId()).getChargedBytes()).isEqualTo(5);
    }

    @Test void memberCannotReadAnotherUploadersUnsentDraft() throws Exception {
        AttachmentResponse response = upload();
        String other = UUID.randomUUID().toString(); session(other);
        assertThatThrownBy(() -> service.download(room.getSlug(), other, response.getPublicId(), false))
                .isInstanceOf(SecurityException.class);
    }

    @Test void expiredContentIsDeniedBeforeCleanupRuns() throws Exception {
        AttachmentResponse response = upload();
        Attachment expired = attachment(response.getPublicId());
        expired.setState(AttachmentState.LINKED); expired.setExpiresAt(Instant.now().minusSeconds(1));
        attachments.saveAndFlush(expired);
        assertThatThrownBy(() -> service.download(room.getSlug(), token, response.getPublicId(), false))
                .isInstanceOf(AttachmentConflictException.class);
    }

    @Test void documentCannotBeReturnedAsAnImagePreview() throws Exception {
        AttachmentResponse response = upload();
        assertThatThrownBy(() -> service.download(room.getSlug(), token, response.getPublicId(), true))
                .isInstanceOf(AttachmentConflictException.class);
    }

    @Test void linkedFileIsReadableByMembersButNotRevokedSessions() throws Exception {
        AttachmentResponse response = upload();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            rooms.findBySlugForUpdate(room.getSlug());
            links.bind(room.getId(), owner.getId(), "message", List.of(response.getPublicId()), room.getExpiresAt().plusSeconds(604800));
        });
        String memberToken = UUID.randomUUID().toString(); RoomSession member = session(memberToken);
        try (InputStream input = service.download(room.getSlug(), memberToken, response.getPublicId(), false).getInput()) {
            assertThat(input.readAllBytes()).isEqualTo("notes".getBytes());
        }
        member.setRevokedAt(Instant.now()); sessions.saveAndFlush(member);
        assertThatThrownBy(() -> service.download(room.getSlug(), memberToken, response.getPublicId(), false)).isInstanceOf(SecurityException.class);
    }

    @Test void fileCannotBypassImageSizeLimitByChangingMultipartMime() {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "application/octet-stream", new byte[5 * 1024 * 1024 + 1]);
        assertThatThrownBy(() -> service.upload(room.getSlug(), token, file)).isInstanceOf(UploadTooLargeException.class);
    }

    @Test void canonicalDocumentTypeDoesNotTrustBrowserSuppliedMime() throws Exception {
        AttachmentResponse response = service.upload(room.getSlug(), token,
                new MockMultipartFile("file", "report.xlsx", "application/octet-stream", "workbook".getBytes()));
        assertThat(response.getContentType()).isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @Test void closesCallerOwnedMultipartInputAfterWritingStorage() throws Exception {
        java.util.concurrent.atomic.AtomicBoolean closed = new java.util.concurrent.atomic.AtomicBoolean();
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "notes".getBytes()) {
            @Override public InputStream getInputStream() {
                return new ByteArrayInputStream("notes".getBytes()) {
                    @Override public void close() throws IOException { closed.set(true); super.close(); }
                };
            }
        };
        service.upload(room.getSlug(), token, file);
        assertThat(closed.get()).isTrue();
    }

    @Test void roomQuotaRejectsFurtherUploadsWithoutLeakingBytes() throws Exception {
        properties.setRoomQuotaBytes(8);
        upload();
        assertThatThrownBy(this::upload).isInstanceOf(AttachmentQuotaExceededException.class);
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isEqualTo(5);
        assertThat(attachments.findByRoom_IdAndPublicId(room.getId(), "missing")).isEmpty();
    }

    @Test void uploaderCannotDeleteLinkedFiles() throws Exception {
        AttachmentResponse response = upload();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            rooms.findBySlugForUpdate(room.getSlug());
            links.bind(room.getId(), owner.getId(), "message", List.of(response.getPublicId()), room.getExpiresAt());
        });
        assertThatThrownBy(() -> service.delete(room.getSlug(), token, response.getPublicId())).isInstanceOf(AttachmentConflictException.class);
    }

    @Test void deleteKeepsLedgerAndQuotaUntilPhysicalDeletionSucceeds() throws Exception {
        AttachmentResponse response = upload();
        String key = attachment(response.getPublicId()).getStorageKey();
        service.delete(room.getSlug(), token, response.getPublicId());
        assertThat(attachment(response.getPublicId()).getState()).isEqualTo(AttachmentState.DELETING);
        assertThat(tasks.findByStorageKey(key)).isPresent();
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isEqualTo(5);
        cleanup.cleanup();
        assertThat(attachments.findByRoom_IdAndPublicId(room.getId(), response.getPublicId())).isEmpty();
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isZero();
        assertThat(root.resolve(key)).doesNotExist();
    }

    @Test void failedPhysicalDeletionCanBeRetriedWithoutLosingLedger() throws Exception {
        AttachmentResponse response = upload();
        String key = attachment(response.getPublicId()).getStorageKey();
        doThrow(new IOException("Storage unavailable")).when(storage).delete(key);
        service.delete(room.getSlug(), token, response.getPublicId());
        cleanup.cleanup();
        assertThat(attachment(response.getPublicId()).getState()).isEqualTo(AttachmentState.DELETING);
        assertThat(tasks.findByStorageKey(key).orElseThrow().getAttempts()).isPositive();
        assertThat(root.resolve(key)).exists();
    }

    @Test void sqlWriteFailureDeletesTheStoredObjectAndRollsBackQuota() throws Exception {
        doThrow(new DataIntegrityViolationException("Injected SQL failure")).when(attachments).saveAndFlush(any(Attachment.class));
        assertThatThrownBy(this::upload).isInstanceOf(DataIntegrityViolationException.class);
        assertNoStoredObject();
        assertThat(quotas.findById(room.getId())).isEmpty();
    }

    @Test void failureAtTransactionCommitAlsoDeletesStoredObject() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "notes".getBytes()) {
            @Override public InputStream getInputStream() throws IOException {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void beforeCommit(boolean readOnly) { throw new IllegalStateException("Injected commit failure"); }
                });
                return super.getInputStream();
            }
        };
        assertThatThrownBy(() -> service.upload(room.getSlug(), token, file)).isInstanceOf(IllegalStateException.class);
        assertNoStoredObject();
        assertThat(quotas.findById(room.getId())).isEmpty();
    }

    @Test void rollbackDeletionFailureCreatesIndependentDurableTask() throws Exception {
        doThrow(new DataIntegrityViolationException("Injected SQL failure")).when(attachments).saveAndFlush(any(Attachment.class));
        doThrow(new IOException("Cannot delete")).when(storage).delete(anyString());
        assertThatThrownBy(this::upload).isInstanceOf(DataIntegrityViolationException.class);
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).put(key.capture(), any(InputStream.class), eq(5L));
        assertThat(tasks.findByStorageKey(key.getValue())).isPresent();
    }

    @Test void legacyUploadWithoutQuotaCanBeCleanedUp() throws Exception {
        String key = UUID.randomUUID().toString(); storage.put(key, new ByteArrayInputStream("notes".getBytes()), 5);
        Attachment legacy = attachments.saveAndFlush(Attachment.builder().room(room).publicId(UUID.randomUUID().toString())
                .uploaderSessionId(owner.getId()).clientUploadId(UUID.randomUUID().toString()).originalFilename("legacy.txt")
                .declaredContentType("text/plain").expectedSizeBytes(5).actualSizeBytes(5L).storageKey(key)
                .state(AttachmentState.READY).uploadExpiresAt(Instant.now()).expiresAt(Instant.now().minusSeconds(1)).build());
        cleanup.cleanup();
        assertThat(attachments.findById(legacy.getId())).isEmpty();
    }

    @Test void deleteRacingWithSendCannotRemoveTheCommittedMessagesFile() throws Exception {
        AttachmentResponse response = upload();
        CountDownLatch bound = new CountDownLatch(1); CountDownLatch release = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> sending = executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                rooms.findBySlugForUpdate(room.getSlug());
                links.bind(room.getId(), owner.getId(), "message", List.of(response.getPublicId()), room.getExpiresAt());
                bound.countDown();
                try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out"); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
            }));
            assertThat(bound.await(5, TimeUnit.SECONDS)).isTrue();
            Future<?> deleting = executor.submit(() -> service.delete(room.getSlug(), token, response.getPublicId()));
            Thread.sleep(100);
            release.countDown(); sending.get(5, TimeUnit.SECONDS);
            assertThatThrownBy(() -> deleting.get(5, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(AttachmentConflictException.class);
            assertThat(attachment(response.getPublicId()).getState()).isEqualTo(AttachmentState.LINKED);
        } finally { release.countDown(); executor.shutdownNow(); }
    }

    private AttachmentResponse upload() throws IOException {
        return service.upload(room.getSlug(), token, new MockMultipartFile("file", "notes.txt", "text/plain", "notes".getBytes()));
    }
    private Attachment attachment(String id) { return attachments.findByRoom_IdAndPublicId(room.getId(), id).orElseThrow(); }
    private RoomSession session(String rawToken) {
        return sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .nickname("Member").sessionTokenHash(TokenUtil.sha256(rawToken)).build());
    }
    private void assertNoStoredObject() throws IOException {
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).put(key.capture(), any(InputStream.class), eq(5L));
        assertThat(root.resolve(key.getValue())).doesNotExist();
    }
}
