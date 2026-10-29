package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.*;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.infrastructure.storage.service.impl.StorageServiceImpl;
import com.eventchat.modules.attachment.config.*;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.*;
import com.eventchat.modules.attachment.service.*;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ContextConfiguration(classes = AttachmentWorkflowTest.Config.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AttachmentWorkflowTest {
    @TempDir static Path root;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.upload.storage.root", () -> root.toString());
    }
    @Configuration
    @EntityScan(basePackageClasses = {Attachment.class, Room.class})
    @EnableJpaRepositories(basePackageClasses = {AttachmentRepository.class, RoomRepository.class})
    @EnableConfigurationProperties({AttachmentProperties.class, AttachmentScanProperties.class, StorageProperties.class})
    @Import({AttachmentServiceImpl.class, AttachmentContentServiceImpl.class, AttachmentProcessingService.class,
            AttachmentContentValidator.class, AttachmentAccessService.class, AttachmentLifecycleService.class,
            AttachmentCleanupService.class, AttachmentLinkService.class})
    static class Config {
        @Bean StorageService storage(StorageProperties properties) throws IOException { return new StorageServiceImpl(properties); }
    }
    @Autowired AttachmentService intents;
    @Autowired AttachmentContentService content;
    @Autowired AttachmentProcessingService processing;
    @Autowired AttachmentAccessService access;
    @Autowired AttachmentCleanupService cleanup;
    @Autowired AttachmentLinkService links;
    @Autowired AttachmentRepository attachments;
    @Autowired RoomAttachmentQuotaRepository quotas;
    @Autowired RoomRepository rooms;
    @Autowired RoomSessionRepository sessions;
    @Autowired StorageService storage;
    @Autowired PlatformTransactionManager manager;
    @MockBean AttachmentScanner scanner;
    private Room room;
    private RoomSession owner;
    private String token;

    @BeforeEach void setup() throws IOException {
        token = UUID.randomUUID().toString();
        room = rooms.saveAndFlush(Room.builder().slug(UUID.randomUUID().toString().substring(0, 8))
                .title("Workflow").hostTokenHash("a".repeat(64)).expiresAt(Instant.now().plusSeconds(3600)).build());
        owner = sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .nickname("Owner").sessionTokenHash(TokenUtil.sha256(token)).build());
        when(scanner.isClean(any(), anyLong())).thenReturn(true);
    }

    @Test void cleanImageBecomesReadyWithNormalizedContentThumbnailAndSettledQuota() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(32, 16, BufferedImage.TYPE_INT_RGB), "png", bytes);
        String id = upload(bytes.toByteArray(), "sample.png", "image/png");
        processing.process(attachment(id).getId());
        AttachmentResponse response = access.status(room.getSlug(), token, id);
        assertThat(response.getState()).isEqualTo(AttachmentState.READY);
        assertThat(response.getWidth()).isEqualTo(32);
        assertThat(response.isHasThumbnail()).isTrue();
        Attachment stored = attachment(id);
        try (InputStream preview = storage.open(stored.getThumbnailKey())) { assertThat(ImageIO.read(preview)).isNotNull(); }
        com.eventchat.modules.attachment.model.AttachmentDownload download = access.openContent(room.getSlug(), token, id, true);
        assertThat(download.getContentType()).isEqualTo("image/jpeg");
        assertThat(download.isInline()).isTrue();
        try (InputStream preview = download.getInput()) { assertThat(ImageIO.read(preview)).isNotNull(); }
        assertThat(quotas.findById(room.getId()).orElseThrow().getReservedBytes()).isZero();
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isEqualTo(stored.getChargedBytes());
    }

    @Test void fakeImageIsRejectedEvenAfterCleanAntivirusVerdict() {
        String id = upload("not a png".getBytes(), "fake.png", "image/png");
        processing.process(attachment(id).getId());
        assertThat(attachment(id).getState()).isEqualTo(AttachmentState.REJECTED);
        assertThatThrownBy(() -> access.download(room.getSlug(), token, id)).isInstanceOf(AttachmentConflictException.class);
    }

    @Test void infectedFileNeverBecomesDownloadableAndCleanupReleasesQuota() throws IOException {
        when(scanner.isClean(any(), anyLong())).thenReturn(false);
        String id = upload("unsafe".getBytes(), "file.txt", "text/plain");
        String key = attachment(id).getStorageKey();
        processing.process(attachment(id).getId());
        assertThat(attachment(id).getErrorCode()).isEqualTo("UNSAFE_FILE");
        cleanup.cleanup();
        assertThat(attachments.findByRoom_IdAndPublicId(room.getId(), id)).isEmpty();
        assertThat(quotas.findById(room.getId()).orElseThrow().getReservedBytes()).isZero();
        assertThatThrownBy(() -> storage.open(key)).isInstanceOf(IOException.class);
    }

    @Test void scannerOutageFailsClosedAndCanRecover() throws IOException {
        String id = upload("notes".getBytes(), "file.txt", "text/plain");
        when(scanner.isClean(any(), anyLong())).thenThrow(new IOException("Unavailable"));
        processing.process(attachment(id).getId());
        assertThat(attachment(id).getState()).isEqualTo(AttachmentState.PROCESSING);
        assertThat(attachment(id).getErrorCode()).isEqualTo("PROCESSING_UNAVAILABLE");
        doReturn(true).when(scanner).isClean(any(), anyLong());
        processing.process(attachment(id).getId());
        assertThat(attachment(id).getState()).isEqualTo(AttachmentState.READY);
    }

    @Test void onlyUploaderSeesDraftAndMembersCanReadAfterLinkButRevokedSessionsCannot() {
        String id = readyText();
        String memberToken = UUID.randomUUID().toString();
        RoomSession member = sessions.saveAndFlush(RoomSession.builder().room(room).guestId(UUID.randomUUID().toString())
                .nickname("Member").sessionTokenHash(TokenUtil.sha256(memberToken)).build());
        assertThatThrownBy(() -> access.status(room.getSlug(), memberToken, id)).isInstanceOf(SecurityException.class);
        new TransactionTemplate(manager).executeWithoutResult(status -> links.bind(room.getId(), owner.getId(), "message", List.of(id), room.getExpiresAt().plusSeconds(604800)));
        assertThat(access.download(room.getSlug(), memberToken, id).getState()).isEqualTo(AttachmentState.LINKED);
        assertThatThrownBy(() -> access.cancel(room.getSlug(), token, id)).isInstanceOf(AttachmentConflictException.class);
        member.setRevokedAt(Instant.now()); sessions.saveAndFlush(member);
        assertThatThrownBy(() -> access.download(room.getSlug(), memberToken, id)).isInstanceOf(SecurityException.class);
    }

    @Test void linkingIsIdempotentForSameMessageAndRejectsReuseDuplicatesAndWrongOwner() {
        String id = readyText();
        TransactionTemplate transaction = new TransactionTemplate(manager);
        assertThatThrownBy(() -> transaction.execute(status -> links.bind(room.getId(), owner.getId(), "first", List.of(id, id), room.getExpiresAt())))
                .isInstanceOf(IllegalArgumentException.class);
        transaction.execute(status -> links.bind(room.getId(), owner.getId(), "first", List.of(id), room.getExpiresAt()));
        transaction.execute(status -> links.bind(room.getId(), owner.getId(), "first", List.of(id), room.getExpiresAt()));
        assertThatThrownBy(() -> transaction.execute(status -> links.bind(room.getId(), owner.getId(), "second", List.of(id), room.getExpiresAt())))
                .isInstanceOf(AttachmentConflictException.class);
        assertThat(links.published(room.getId(), "first", List.of(access.status(room.getSlug(), token, id)))).isTrue();
        assertThat(links.published(room.getId(), "second", List.of(access.status(room.getSlug(), token, id)))).isFalse();
    }

    @Test void cancelDuringProcessingCannotResurrectFileOrLeakNormalizedOutputs() throws IOException {
        String id = upload("notes".getBytes(), "file.txt", "text/plain");
        when(scanner.isClean(any(), anyLong())).thenAnswer(invocation -> {
            access.cancel(room.getSlug(), token, id);
            cleanup.cleanup();
            return true;
        });
        processing.process(attachment(id).getId());
        cleanup.cleanup();
        assertThat(attachments.findByRoom_IdAndPublicId(room.getId(), id)).isEmpty();
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isZero();
    }

    @Test void cancelledReadyFileReleasesStoredQuotaOnlyAfterDeletion() {
        String id = readyText();
        access.cancel(room.getSlug(), token, id);
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isPositive();
        cleanup.cleanup();
        assertThat(quotas.findById(room.getId()).orElseThrow().getStoredBytes()).isZero();
    }

    private String readyText() {
        String id = upload("notes".getBytes(), "file.txt", "text/plain");
        processing.process(attachment(id).getId());
        return id;
    }
    private String upload(byte[] bytes, String filename, String type) {
        CreateUploadIntentRequest request = new CreateUploadIntentRequest();
        request.setClientUploadId(UUID.randomUUID().toString()); request.setFilename(filename);
        request.setDeclaredContentType(type); request.setSizeBytes((long) bytes.length);
        String id = intents.createIntent(room.getSlug(), token, request).getPublicId();
        content.upload(room.getSlug(), token, id, bytes.length, new ByteArrayInputStream(bytes));
        return id;
    }
    private Attachment attachment(String id) { return attachments.findByRoom_IdAndPublicId(room.getId(), id).orElseThrow(); }
}
