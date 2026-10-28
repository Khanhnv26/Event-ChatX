package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentStorageException;
import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.modules.attachment.dto.response.UploadContentResponse;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.entity.AttachmentDeleteTask;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentDeleteTaskRepository;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.service.AttachmentContentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Semaphore;

@Service
public class AttachmentContentServiceImpl implements AttachmentContentService {
    private final RoomRepository rooms;
    private final RoomSessionRepository sessions;
    private final AttachmentRepository attachments;
    private final AttachmentDeleteTaskRepository deleteTasks;
    private final StorageService storage;
    private final TransactionTemplate transactions;
    private final Semaphore uploadSlots;

    public AttachmentContentServiceImpl(RoomRepository rooms, RoomSessionRepository sessions,
                                        AttachmentRepository attachments, AttachmentDeleteTaskRepository deleteTasks,
                                        StorageService storage, PlatformTransactionManager transactionManager,
                                        AttachmentProperties properties) {
        this.rooms = rooms;
        this.sessions = sessions;
        this.attachments = attachments;
        this.deleteTasks = deleteTasks;
        this.storage = storage;
        this.uploadSlots = new Semaphore(properties.getMaxConcurrentUploads());
        this.transactions = new TransactionTemplate(transactionManager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.transactions.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Override
    public UploadContentResponse upload(String slug, String sessionToken, String publicId,
                                        long contentLength, InputStream input) {
        Objects.requireNonNull(input, "Input");
        if (!uploadSlots.tryAcquire()) {
            throw new AttachmentStorageException(new IllegalStateException("Upload concurrency limit reached"));
        }
        try {
            Attachment reservation = transactions.execute(status -> {
                Attachment attachment = requireOwnedWritableAttachment(slug, sessionToken, publicId);
                if (attachment.getState() != AttachmentState.RESERVED) {
                    throw new AttachmentConflictException("Tệp đang upload hoặc đã nhận nội dung; không được ghi đè");
                }
                if (contentLength > attachment.getExpectedSizeBytes()) {
                    throw new UploadTooLargeException(attachment.getExpectedSizeBytes());
                }
                if (contentLength >= 0 && contentLength != attachment.getExpectedSizeBytes()) {
                    throw new IllegalArgumentException("Kích thước nội dung không khớp intent");
                }
                // The room lock serializes claims, including the per-session concurrency check.
                if (attachments.countByRoom_IdAndUploaderSessionIdAndState(attachment.getRoom().getId(),
                        attachment.getUploaderSessionId(), AttachmentState.UPLOADING) >= 2) {
                    throw new AttachmentConflictException("Mỗi phiên chỉ được upload đồng thời tối đa 2 tệp");
                }
                attachment.setState(AttachmentState.UPLOADING);
                attachment.setStorageKey(UUID.randomUUID().toString());
                attachment.setErrorCode(null);
                return attachments.saveAndFlush(attachment);
            });

            // No database transaction or row lock is held while reading network bytes.
            try {
                StoredObject object = storage.put(reservation.getStorageKey(), input, reservation.getExpectedSizeBytes());
                if (object.getSizeBytes() != reservation.getExpectedSizeBytes()) {
                    throw new IllegalArgumentException("Kích thước nội dung không khớp intent");
                }
                return transactions.execute(status -> {
                    // Recheck expiry, room state and revocation after the potentially slow upload.
                    Attachment attachment = requireOwnedWritableAttachment(slug, sessionToken, publicId);
                    if (attachment.getState() != AttachmentState.UPLOADING
                            || !reservation.getStorageKey().equals(attachment.getStorageKey())) {
                        throw new AttachmentConflictException("Lượt upload không còn hợp lệ");
                    }
                    attachment.setActualSizeBytes(object.getSizeBytes());
                    attachment.setSha256(object.getSha256());
                    attachment.setState(AttachmentState.PROCESSING);
                    attachments.saveAndFlush(attachment);
                    // Keep the reservation until scanning and image processing settle actual storage usage.
                    return new UploadContentResponse(publicId, AttachmentState.PROCESSING, object.getSizeBytes());
                });
            } catch (IOException ex) {
                AttachmentStorageException failure = new AttachmentStorageException(ex);
                recoverFailedUpload(reservation, failure);
                throw failure;
            } catch (RuntimeException ex) {
                recoverFailedUpload(reservation, ex);
                throw ex;
            }
        } finally {
            uploadSlots.release();
        }
    }

    private Attachment requireOwnedWritableAttachment(String slug, String token, String publicId) {
        if (token == null || token.isBlank()) {
            throw new SecurityException("Thiếu phiên tham gia phòng");
        }
        Room room = rooms.findBySlugForUpdate(slug)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(token))
                .orElseThrow(() -> new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ"));
        Attachment attachment = attachments.findForUpdate(room.getId(), publicId)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập tệp"));
        if (!session.getId().equals(attachment.getUploaderSessionId())) {
            throw new SecurityException("Chỉ người tạo intent được upload tệp");
        }
        Instant now = Instant.now();
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !room.getExpiresAt().isAfter(now)
                || !attachment.getUploadExpiresAt().isAfter(now) || !attachment.getExpiresAt().isAfter(now)) {
            throw new AttachmentConflictException("Phòng hoặc intent đã đóng hay hết hạn");
        }
        return attachment;
    }

    private void recoverFailedUpload(Attachment reservation, RuntimeException failure) {
        try {
            boolean cleanup = Boolean.TRUE.equals(transactions.execute(status -> {
                Attachment attachment = attachments.findForUpdate(reservation.getRoom().getId(), reservation.getPublicId())
                        .orElse(null);
                if (attachment == null || attachment.getState() != AttachmentState.UPLOADING
                        || !reservation.getStorageKey().equals(attachment.getStorageKey())) {
                    return false;
                }
                // Record deletion durably before touching storage. Do not discard the ledger on failure.
                if (deleteTasks.findByStorageKey(reservation.getStorageKey()).isEmpty()) {
                    deleteTasks.saveAndFlush(AttachmentDeleteTask.builder()
                            .storageKey(reservation.getStorageKey()).lastErrorCode("UPLOAD_FAILED").build());
                }
                attachment.setErrorCode("UPLOAD_FAILED");
                return true;
            }));
            if (!cleanup) {
                return;
            }
            storage.delete(reservation.getStorageKey());
            transactions.executeWithoutResult(status -> {
                Attachment attachment = attachments.findForUpdate(reservation.getRoom().getId(), reservation.getPublicId())
                        .orElseThrow();
                if (attachment.getState() == AttachmentState.UPLOADING
                        && reservation.getStorageKey().equals(attachment.getStorageKey())) {
                    attachment.setState(AttachmentState.RESERVED);
                    attachment.setStorageKey(null);
                    attachment.setActualSizeBytes(null);
                    attachment.setSha256(null);
                    deleteTasks.findByStorageKey(reservation.getStorageKey()).ifPresent(deleteTasks::delete);
                }
            });
        } catch (IOException | RuntimeException cleanupFailure) {
            failure.addSuppressed(cleanupFailure);
        }
    }
}
