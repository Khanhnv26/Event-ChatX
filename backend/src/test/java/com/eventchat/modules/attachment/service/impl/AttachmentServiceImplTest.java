package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentQuotaExceededException;
import com.eventchat.common.exception.UnsupportedAttachmentTypeException;
import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.repository.RoomAttachmentQuotaRepository;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

@DataJpaTest(showSql = false, properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ContextConfiguration(classes = AttachmentServiceImplTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AttachmentServiceImplTest {
    @Configuration
    @EntityScan(basePackageClasses = {Attachment.class, Room.class})
    @EnableJpaRepositories(basePackageClasses = {AttachmentRepository.class, RoomRepository.class})
    @EnableConfigurationProperties({AttachmentProperties.class, StorageProperties.class})
    @Import(AttachmentServiceImpl.class)
    static class Config {}

    @Autowired AttachmentService service;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @SpyBean AttachmentRepository attachments;
    @Autowired RoomAttachmentQuotaRepository quotas;
    @Autowired AttachmentProperties properties;

    @BeforeEach
    void resetQuotaLimit() {
        properties.setRoomQuotaBytes(200L * 1024 * 1024);
    }

    @Test
    void retryReturnsSameIntentWithoutReservingAgainOrExtendingDeadline() {
        Owner owner = owner();
        CreateUploadIntentRequest request = request("notes.pdf", "application/pdf", 1024);
        UploadIntentResponse first = service.createIntent(owner.room.getSlug(), owner.token, request);
        UploadIntentResponse retry = service.createIntent(owner.room.getSlug(), owner.token, request);

        assertThat(first.getState()).isEqualTo(AttachmentState.RESERVED);
        assertThat(retry.getPublicId()).isEqualTo(first.getPublicId());
        assertThat(retry.getUploadExpiresAt()).isEqualTo(first.getUploadExpiresAt());
        assertThat(reserved(owner)).isEqualTo(1024);
    }

    @Test
    void reusingClientIdForDifferentPayloadIsRejected() {
        Owner owner = owner();
        CreateUploadIntentRequest request = request("notes.pdf", "application/pdf", 1024);
        service.createIntent(owner.room.getSlug(), owner.token, request);
        request.setSizeBytes(2048L);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token, request))
                .isInstanceOf(AttachmentConflictException.class);
        assertThat(reserved(owner)).isEqualTo(1024);
    }

    @Test
    void revokedSessionCannotReserveSpace() {
        Owner owner = owner();
        owner.session.setRevokedAt(Instant.now());
        sessions.saveAndFlush(owner.session);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("notes.pdf", "application/pdf", 1024)))
                .isInstanceOf(SecurityException.class);
        assertThat(quotas.findById(owner.room.getId())).isEmpty();
    }

    @Test
    void missingOrOtherRoomsTokenCannotReserveSpace() {
        Owner owner = owner();
        Owner other = owner();
        CreateUploadIntentRequest request = request("notes.pdf", "application/pdf", 1024);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), null, request))
                .isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), other.token, request))
                .isInstanceOf(SecurityException.class);
        assertThat(quotas.findById(owner.room.getId())).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(value = RoomStatus.class, names = {"CLOSED", "EXPIRED"})
    void nonActiveRoomCannotReserveSpace(RoomStatus status) {
        Owner owner = owner();
        owner.room.setRoomStatus(status);
        rooms.saveAndFlush(owner.room);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("notes.pdf", "application/pdf", 1024)))
                .isInstanceOf(AttachmentConflictException.class);
        assertThat(quotas.findById(owner.room.getId())).isEmpty();
    }

    @Test
    void expiredRoomIsRejectedEvenIfItsStatusStillSaysActive() {
        Owner owner = owner();
        owner.room.setExpiresAt(Instant.now().minusSeconds(1));
        rooms.saveAndFlush(owner.room);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("notes.pdf", "application/pdf", 1024)))
                .isInstanceOf(AttachmentConflictException.class);
    }

    @Test
    void oversizedImagesAndUnsupportedExtensionsAreRejectedBeforeReservation() {
        Owner owner = owner();
        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("photo.png", "image/png", 6L * 1024 * 1024)))
                .isInstanceOf(UploadTooLargeException.class);
        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("run.exe", "application/pdf", 1024)))
                .isInstanceOf(UnsupportedAttachmentTypeException.class);
        assertThat(quotas.findById(owner.room.getId())).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(value = AttachmentState.class, names = {"RESERVED", "UPLOADING", "PROCESSING"})
    void expiredUploadCannotBeExtendedByRetry(AttachmentState state) {
        Owner owner = owner();
        CreateUploadIntentRequest request = request("notes.pdf", "application/pdf", 1024);
        UploadIntentResponse response = service.createIntent(owner.room.getSlug(), owner.token, request);
        Attachment attachment = attachments.findByRoom_IdAndPublicId(
                owner.room.getId(), response.getPublicId()).orElseThrow();
        attachment.setState(state);
        attachment.setUploadExpiresAt(Instant.now().minusSeconds(1));
        attachments.saveAndFlush(attachment);

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token, request))
                .isInstanceOf(AttachmentConflictException.class);
        assertThat(reserved(owner)).isEqualTo(1024);
    }

    @Test
    void imageReservationIncludesBoundedProcessingSpace() {
        Owner owner = owner();
        service.createIntent(owner.room.getSlug(), owner.token,
                request("photo.png", "image/png", 1024));
        assertThat(reserved(owner)).isEqualTo(1024 + 5L * 1024 * 1024 + 512L * 1024);
    }

    @Test
    void deadlineDoesNotExtendPastRoomExpiry() {
        Owner owner = owner();
        owner.room.setExpiresAt(Instant.now().truncatedTo(ChronoUnit.MILLIS).plusSeconds(45));
        rooms.saveAndFlush(owner.room);

        UploadIntentResponse response = service.createIntent(owner.room.getSlug(), owner.token,
                request("notes.pdf", "application/pdf", 1024));
        assertThat(response.getUploadExpiresAt()).isAfter(Instant.now())
                .isBeforeOrEqualTo(owner.room.getExpiresAt());
    }

    @Test
    void failureSavingAttachmentRollsBackTheQuotaRow() {
        Owner owner = owner();
        doThrow(new DataIntegrityViolationException("injected write failure"))
                .when(attachments).saveAndFlush(any(Attachment.class));

        assertThatThrownBy(() -> service.createIntent(owner.room.getSlug(), owner.token,
                request("notes.pdf", "application/pdf", 1024)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(quotas.findById(owner.room.getId())).isEmpty();
    }

    @Test
    void onlyOneConcurrentRequestCanUseTheLastAvailableQuota() throws Exception {
        properties.setRoomQuotaBytes(20L * 1024 * 1024);
        Owner owner = owner();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> action = () -> {
                start.await();
                try {
                    service.createIntent(owner.room.getSlug(), owner.token,
                            request("notes.pdf", "application/pdf", 12L * 1024 * 1024));
                    return true;
                } catch (AttachmentQuotaExceededException expected) {
                    return false;
                }
            };
            Future<Boolean> first = executor.submit(action);
            Future<Boolean> second = executor.submit(action);
            start.countDown();
            int accepted = (first.get(10, TimeUnit.SECONDS) ? 1 : 0)
                    + (second.get(10, TimeUnit.SECONDS) ? 1 : 0);
            assertThat(accepted).isEqualTo(1);
            assertThat(reserved(owner)).isEqualTo(12L * 1024 * 1024);
        } finally {
            executor.shutdownNow();
        }
    }

    private Owner owner() {
        Room room = rooms.saveAndFlush(Room.builder()
                .slug(UUID.randomUUID().toString().substring(0, 8))
                .title("Attachment test").hostTokenHash("a".repeat(64))
                .expiresAt(Instant.now().truncatedTo(ChronoUnit.MILLIS).plusSeconds(3600))
                .build());
        String token = UUID.randomUUID().toString();
        RoomSession session = sessions.saveAndFlush(RoomSession.builder().room(room)
                .guestId(UUID.randomUUID().toString()).sessionTokenHash(TokenUtil.sha256(token))
                .nickname("Test guest").build());
        return new Owner(room, session, token);
    }

    private CreateUploadIntentRequest request(String filename, String contentType, long sizeBytes) {
        CreateUploadIntentRequest request = new CreateUploadIntentRequest();
        request.setClientUploadId(UUID.randomUUID().toString());
        request.setFilename(filename);
        request.setDeclaredContentType(contentType);
        request.setSizeBytes(sizeBytes);
        return request;
    }

    private long reserved(Owner owner) {
        return quotas.findById(owner.room.getId()).orElseThrow().getReservedBytes();
    }

    private static class Owner {
        private final Room room;
        private final RoomSession session;
        private final String token;

        private Owner(Room room, RoomSession session, String token) {
            this.room = room;
            this.session = session;
            this.token = token;
        }
    }
}
