package com.eventchat.modules.attachment.service.impl;

import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.entity.*;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.model.ProcessedAttachment;
import com.eventchat.modules.attachment.repository.*;
import com.eventchat.modules.attachment.service.AttachmentScanner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.*;
import java.time.Instant;
import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
public class AttachmentProcessingService {
    private final AttachmentRepository attachments;
    private final RoomAttachmentQuotaRepository quotas;
    private final StorageService storage;
    private final AttachmentScanner scanner;
    private final AttachmentContentValidator validator;
    private final AttachmentProperties properties;
    private final TransactionTemplate transactions;
    private final AttachmentLifecycleService lifecycle;

    public AttachmentProcessingService(AttachmentRepository attachments, RoomAttachmentQuotaRepository quotas,
            StorageService storage, AttachmentScanner scanner, AttachmentContentValidator validator,
            AttachmentProperties properties, PlatformTransactionManager manager, AttachmentLifecycleService lifecycle) {
        this.attachments = attachments;
        this.quotas = quotas;
        this.storage = storage;
        this.scanner = scanner;
        this.validator = validator;
        this.properties = properties;
        this.transactions = new TransactionTemplate(manager);
        this.lifecycle = lifecycle;
    }

    @Scheduled(fixedDelayString = "${app.upload.processing-delay-ms:2000}")
    public synchronized void processPending() {
        for (Attachment attachment : attachments.findTop10ByStateOrderByIdAsc(AttachmentState.PROCESSING)) {
            try { process(attachment.getId()); }
            catch (RuntimeException ex) { log.warn("Attachment processing deferred: id={}, reason={}", attachment.getId(), ex.getClass().getSimpleName()); }
        }
    }

    public synchronized void process(Long id) {
        Attachment work = transactions.execute(status -> {
            Attachment candidate = attachments.findById(id).orElse(null);
            if (candidate == null) return null;
            Attachment locked = attachments.findForUpdate(candidate.getRoom().getId(), candidate.getPublicId()).orElseThrow();
            if (locked.getState() != AttachmentState.PROCESSING) return null;
            if (!locked.getUploadExpiresAt().isAfter(Instant.now())) {
                locked.setState(AttachmentState.REJECTED);
                locked.setErrorCode("UPLOAD_EXPIRED");
                return null;
            }
            if (locked.getDeclaredContentType().startsWith("image/") && locked.getThumbnailKey() == null) {
                locked.setThumbnailKey(UUID.randomUUID().toString());
            }
            return locked;
        });
        if (work == null) return;
        try {
            try (InputStream input = storage.open(work.getStorageKey())) {
                if (!scanner.isClean(input, properties.getFileMaxBytes())) {
                    reject(work, "UNSAFE_FILE");
                    return;
                }
            }
            byte[] bytes;
            try (InputStream input = storage.open(work.getStorageKey())) {
                bytes = input.readNBytes(Math.toIntExact(properties.getFileMaxBytes() + 1));
            }
            if (bytes.length > properties.getFileMaxBytes()) {
                reject(work, "FILE_TOO_LARGE");
                return;
            }
            ProcessedAttachment processed;
            try { processed = validator.validate(bytes, work.getDeclaredContentType()); }
            catch (IOException | IllegalArgumentException ex) { reject(work, "INVALID_CONTENT"); return; }
            StoredObject normalized;
            long thumbnailBytes = 0;
            if (processed.getThumbnail() != null) {
                normalized = storage.replace(work.getStorageKey(), new ByteArrayInputStream(processed.getContent()), properties.getImageMaxBytes());
                StoredObject thumbnail = storage.replace(work.getThumbnailKey(), new ByteArrayInputStream(processed.getThumbnail()), 512L * 1024);
                thumbnailBytes = thumbnail.getSizeBytes();
            } else {
                normalized = StoredObject.builder().key(work.getStorageKey()).sizeBytes(bytes.length).sha256(work.getSha256()).build();
            }
            long charged = normalized.getSizeBytes() + thumbnailBytes;
            transactions.executeWithoutResult(status -> {
                Attachment locked = attachments.findForUpdate(work.getRoom().getId(), work.getPublicId()).orElse(null);
                if (locked == null || locked.getState() != AttachmentState.PROCESSING) {
                    lifecycle.queueKeys(work.getStorageKey(), work.getThumbnailKey());
                    return;
                }
                if (!locked.getUploadExpiresAt().isAfter(Instant.now())) {
                    locked.setState(AttachmentState.REJECTED);
                    locked.setErrorCode("UPLOAD_EXPIRED");
                    return;
                }
                RoomAttachmentQuota quota = quotas.findForUpdate(work.getRoom().getId()).orElseThrow();
                if (charged > locked.getReservedBytes() || quota.getReservedBytes() < locked.getReservedBytes()) {
                    throw new IllegalStateException("Attachment reservation mismatch");
                }
                quota.setReservedBytes(quota.getReservedBytes() - locked.getReservedBytes());
                quota.setStoredBytes(quota.getStoredBytes() + charged);
                locked.setReservedBytes(0);
                locked.setChargedBytes(charged);
                locked.setActualSizeBytes(normalized.getSizeBytes());
                locked.setSha256(normalized.getSha256());
                locked.setDetectedContentType(processed.getContentType());
                locked.setWidthPx(processed.getWidth());
                locked.setHeightPx(processed.getHeight());
                locked.setErrorCode(null);
                locked.setExpiresAt(Instant.now().plus(Duration.ofHours(24)).isBefore(locked.getExpiresAt())
                        ? Instant.now().plus(Duration.ofHours(24)) : locked.getExpiresAt());
                locked.setState(AttachmentState.READY);
            });
        } catch (com.eventchat.common.exception.UnsupportedAttachmentTypeException | com.eventchat.common.exception.UploadTooLargeException ex) {
            reject(work, "INVALID_CONTENT");
        } catch (IOException ex) {
            // Fail closed: scanner/storage outage never changes an attachment to READY.
            transactions.executeWithoutResult(status -> {
                Attachment attachment = attachments.findForUpdate(work.getRoom().getId(), work.getPublicId()).orElse(null);
                if (attachment != null && attachment.getState() == AttachmentState.PROCESSING) attachment.setErrorCode("PROCESSING_UNAVAILABLE");
                else lifecycle.queueKeys(work.getStorageKey(), work.getThumbnailKey());
            });
        }
    }

    private void reject(Attachment work, String code) {
        transactions.executeWithoutResult(status -> {
            Attachment attachment = attachments.findForUpdate(work.getRoom().getId(), work.getPublicId()).orElse(null);
            if (attachment != null && attachment.getState() == AttachmentState.PROCESSING) {
                attachment.setState(AttachmentState.REJECTED);
                attachment.setErrorCode(code);
            } else lifecycle.queueKeys(work.getStorageKey(), work.getThumbnailKey());
        });
    }
}
