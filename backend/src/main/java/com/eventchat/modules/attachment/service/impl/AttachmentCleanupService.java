package com.eventchat.modules.attachment.service.impl;

import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.modules.attachment.entity.*;
import com.eventchat.modules.attachment.enums.*;
import com.eventchat.modules.attachment.repository.*;
import com.eventchat.modules.room.repository.RoomRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
public class AttachmentCleanupService {
    private final AttachmentRepository attachments;
    private final AttachmentDeleteTaskRepository tasks;
    private final RoomRepository rooms;
    private final AttachmentLifecycleService lifecycle;
    private final StorageService storage;
    private final TransactionTemplate transactions;

    public AttachmentCleanupService(AttachmentRepository attachments, AttachmentDeleteTaskRepository tasks,
            RoomRepository rooms, AttachmentLifecycleService lifecycle,
            StorageService storage, PlatformTransactionManager manager) {
        this.attachments = attachments;
        this.tasks = tasks;
        this.rooms = rooms;
        this.lifecycle = lifecycle;
        this.storage = storage;
        this.transactions = new TransactionTemplate(manager);
    }

    @Scheduled(fixedDelayString = "${app.upload.cleanup-delay-ms:10000}")
    public synchronized void cleanup() {
        try {
            List<Attachment> candidates = attachments.findCleanupCandidates(
                    List.of(AttachmentState.DELETING, AttachmentState.REJECTED, AttachmentState.EXPIRED),
                    List.of(AttachmentState.RESERVED, AttachmentState.UPLOADING, AttachmentState.PROCESSING),
                    Instant.now(), PageRequest.of(0, 25));
            for (Attachment candidate : candidates) {
                transactions.executeWithoutResult(status -> {
                    rooms.findById(candidate.getRoom().getId()).ifPresent(room -> rooms.findBySlugForUpdate(room.getSlug()));
                    Attachment attachment = attachments.findForUpdate(candidate.getRoom().getId(), candidate.getPublicId()).orElse(null);
                    if (attachment == null || attachment.getState() == AttachmentState.DELETING) return;
                    boolean terminal = attachment.getState() == AttachmentState.REJECTED || attachment.getState() == AttachmentState.EXPIRED;
                    boolean pending = List.of(AttachmentState.RESERVED, AttachmentState.UPLOADING, AttachmentState.PROCESSING).contains(attachment.getState());
                    if (terminal || !attachment.getExpiresAt().isAfter(Instant.now())
                            || pending && !attachment.getUploadExpiresAt().isAfter(Instant.now())) lifecycle.queueDeletion(attachment);
                });
            }
            for (AttachmentDeleteTask task : tasks.findTop25ByStateAndNextAttemptAtLessThanEqualOrderByIdAsc(
                    AttachmentDeleteState.PENDING, Instant.now())) {
                try {
                    storage.delete(task.getStorageKey());
                    task.setState(AttachmentDeleteState.DONE);
                    task.setLastErrorCode(null);
                } catch (IOException | RuntimeException ex) {
                    task.setAttempts(task.getAttempts() + 1);
                    task.setLastErrorCode("STORAGE_UNAVAILABLE");
                    task.setNextAttemptAt(Instant.now().plusSeconds(Math.min(3600, 10L * (1L << Math.min(task.getAttempts(), 8)))));
                }
                tasks.saveAndFlush(task);
            }
            for (Attachment candidate : candidates) {
                transactions.executeWithoutResult(status -> {
                    // Same lock order as chat/upload; quota is released only after physical deletion.
                    rooms.findById(candidate.getRoom().getId()).ifPresent(room -> rooms.findBySlugForUpdate(room.getSlug()));
                    Attachment attachment = attachments.findForUpdate(candidate.getRoom().getId(), candidate.getPublicId()).orElse(null);
                    if (attachment == null || attachment.getState() != AttachmentState.DELETING) return;
                    for (String key : new String[]{attachment.getStorageKey(), attachment.getThumbnailKey()}) {
                        if (key != null && tasks.findByStorageKey(key).filter(task -> task.getState() == AttachmentDeleteState.DONE).isEmpty()) return;
                    }
                    RoomAttachmentQuota quota = lifecycle.reconcileQuota(attachment.getRoom().getId());
                    quota.setReservedBytes(quota.getReservedBytes() - attachment.getReservedBytes());
                    quota.setStoredBytes(quota.getStoredBytes() - attachment.getChargedBytes());
                    attachments.delete(attachment);
                });
            }
        } catch (RuntimeException ex) {
            log.warn("Attachment cleanup deferred: {}", ex.getClass().getSimpleName());
        }
    }
}
