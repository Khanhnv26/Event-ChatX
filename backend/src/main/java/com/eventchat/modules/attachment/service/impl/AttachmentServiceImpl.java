package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.*;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.entity.RoomAttachmentQuota;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.PushbackInputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {
    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "jpg", "image/jpeg", "jpeg", "image/jpeg", "png", "image/png", "pdf", "application/pdf",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "txt", "text/plain", "csv", "text/csv");

    private final RoomRepository roomRepository;
    private final RoomSessionRepository sessionRepository;
    private final AttachmentRepository attachmentRepository;
    private final StorageService storageService;
    private final AttachmentLifecycleService lifecycle;
    private final AttachmentProperties properties;
    private final PlatformTransactionManager transactionManager;

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED, rollbackFor = Exception.class)
    public AttachmentResponse upload(String slug, String sessionToken, MultipartFile file) {
        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = requireSession(room.getId(), sessionToken);
        requireWritable(room);
        if (file == null || file.isEmpty() || file.getSize() <= 0) throw new IllegalArgumentException("File tải lên không được rỗng");

        String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "").strip();
        if (filename.isEmpty() || filename.length() > 255 || filename.contains("/") || filename.contains("\\")
                || filename.contains(":") || filename.codePoints().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Tên file không hợp lệ");
        }
        String contentType = CONTENT_TYPES.get(extension(filename));
        if (contentType == null) throw new UnsupportedAttachmentTypeException();
        // Multipart Content-Type is supplied by the client and must not choose the image limit or inline policy.
        boolean image = contentType.startsWith("image/");
        long maxBytes = image ? properties.getImageMaxBytes() : properties.getFileMaxBytes();
        if (file.getSize() > maxBytes) throw new UploadTooLargeException(maxBytes);

        RoomAttachmentQuota quota = lifecycle.reconcileQuota(room.getId());
        long roomLimit = properties.getRoomQuotaBytes();
        if (quota.getStoredBytes() > roomLimit || quota.getReservedBytes() > roomLimit - quota.getStoredBytes()
                || file.getSize() > roomLimit - quota.getStoredBytes() - quota.getReservedBytes()) {
            throw new AttachmentQuotaExceededException();
        }

        String storageKey = UUID.randomUUID().toString();
        // Filesystem changes do not roll back with SQL, including a failure during transaction commit.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) cleanupAfterRollback(storageKey);
            }
        });
        StoredObject stored;
        try (PushbackInputStream input = new PushbackInputStream(file.getInputStream(), 8)) {
            if (image) verifyImageHeader(input, contentType);
            stored = storageService.put(storageKey, input, file.getSize());
        } catch (IOException ex) {
            throw new AttachmentStorageException(ex);
        }
        if (stored.getSizeBytes() != file.getSize()) throw new IllegalArgumentException("Kích thước nội dung file không khớp");
        requireWritable(room);
        if (!sessionRepository.existsByIdAndRoomIdAndRevokedAtIsNull(session.getId(), room.getId())) {
            throw new SecurityException("Phiên đã bị thu hồi");
        }

        Instant now = Instant.now();
        Instant retention = room.getExpiresAt().plus(Duration.ofDays(7));
        Instant draftExpiry = now.plus(Duration.ofHours(24));
        Attachment attachment = Attachment.builder().publicId(UUID.randomUUID().toString()).room(room)
                .uploaderSessionId(session.getId()).clientUploadId(UUID.randomUUID().toString())
                .originalFilename(filename).declaredContentType(contentType).detectedContentType(contentType)
                .expectedSizeBytes(file.getSize()).actualSizeBytes(stored.getSizeBytes()).storageKey(storageKey)
                .sha256(stored.getSha256()).chargedBytes(stored.getSizeBytes()).state(AttachmentState.READY)
                .uploadExpiresAt(draftExpiry).expiresAt(draftExpiry.isBefore(retention) ? draftExpiry : retention).build();
        quota.setStoredBytes(Math.addExact(quota.getStoredBytes(), stored.getSizeBytes()));
        attachmentRepository.saveAndFlush(attachment);
        return AttachmentLifecycleService.response(attachment);
    }

    @Override
    @Transactional(readOnly = true)
    public AttachmentDownload download(String slug, String sessionToken, String publicId, boolean thumbnail) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = requireSession(room.getId(), sessionToken);
        Attachment attachment = attachmentRepository.findByRoom_IdAndPublicId(room.getId(), publicId)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập file"));
        if (attachment.getState() != AttachmentState.READY && attachment.getState() != AttachmentState.LINKED
                || !attachment.getExpiresAt().isAfter(Instant.now())) {
            throw new AttachmentConflictException("File chưa sẵn sàng, đã bị xóa hoặc hết hạn");
        }
        if (attachment.getState() != AttachmentState.LINKED && !session.getId().equals(attachment.getUploaderSessionId())) {
            throw new SecurityException("Chỉ người upload được xem file chưa gửi");
        }
        boolean hasThumbnail = thumbnail && attachment.getThumbnailKey() != null;
        String key = hasThumbnail ? attachment.getThumbnailKey() : attachment.getStorageKey();
        if (key == null) throw new AttachmentConflictException("Nội dung file không tồn tại");
        String contentType = hasThumbnail ? "image/jpeg"
                : CONTENT_TYPES.getOrDefault(extension(attachment.getOriginalFilename()), "application/octet-stream");
        if (thumbnail && !contentType.startsWith("image/")) throw new AttachmentConflictException("File không có ảnh xem trước");
        try {
            InputStream input = storageService.open(key);
            return new AttachmentDownload(attachment.getOriginalFilename(), contentType, contentType.startsWith("image/"), input);
        } catch (IOException ex) { throw new AttachmentStorageException(ex); }
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void delete(String slug, String sessionToken, String publicId) {
        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = requireSession(room.getId(), sessionToken);
        Attachment attachment = attachmentRepository.findForUpdate(room.getId(), publicId)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập file"));
        if (!session.getId().equals(attachment.getUploaderSessionId())) throw new SecurityException("Chỉ người upload mới có quyền xóa file");
        if (attachment.getState() == AttachmentState.LINKED || attachment.getState() == AttachmentState.LINKING) {
            throw new AttachmentConflictException("Không thể xóa file đã được gửi trong tin nhắn");
        }
        if (attachment.getState() != AttachmentState.DELETING) lifecycle.queueDeletion(attachment);
    }

    private RoomSession requireSession(Long roomId, String token) {
        if (token == null || token.isBlank()) throw new SecurityException("Thiếu phiên tham gia phòng");
        return sessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(roomId, TokenUtil.sha256(token))
                .orElseThrow(() -> new SecurityException("Phiên không hợp lệ hoặc đã bị thu hồi"));
    }

    private void requireWritable(Room room) {
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !room.getExpiresAt().isAfter(Instant.now())) {
            throw new AttachmentConflictException("Phòng đã đóng hoặc hết hạn, không thể upload file");
        }
    }

    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private void verifyImageHeader(PushbackInputStream input, String contentType) throws IOException {
        byte[] header = input.readNBytes(8);
        boolean valid = contentType.equals("image/png")
                ? Arrays.equals(header, new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10})
                : header.length >= 3 && header[0] == (byte) 255 && header[1] == (byte) 216 && header[2] == (byte) 255;
        if (!valid) throw new UnsupportedAttachmentTypeException();
        input.unread(header);
    }

    private void cleanupAfterRollback(String key) {
        try { storageService.delete(key); }
        catch (IOException | RuntimeException ex) {
            try {
                TransactionTemplate cleanup = new TransactionTemplate(transactionManager);
                cleanup.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                cleanup.executeWithoutResult(status -> lifecycle.queueKeys(key));
            } catch (RuntimeException queueFailure) {
                log.error("Cannot queue rolled-back attachment for deletion: key={}", key, queueFailure);
            }
        }
    }
}
