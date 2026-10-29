package com.eventchat.modules.attachment.service.impl;

import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.*;
import com.eventchat.modules.attachment.enums.*;
import com.eventchat.modules.attachment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttachmentLifecycleService {
    private final AttachmentDeleteTaskRepository tasks;
    private final AttachmentRepository attachments;
    private final RoomAttachmentQuotaRepository quotas;

    // Caller holds the Room lock. Rebuild counters also covers uploads made before quota accounting existed.
    public RoomAttachmentQuota reconcileQuota(Long roomId) {
        RoomAttachmentQuota quota = quotas.findForUpdate(roomId).orElseGet(() -> {
            RoomAttachmentQuota created = new RoomAttachmentQuota();
            created.setRoomId(roomId);
            return quotas.saveAndFlush(created);
        });
        long stored = 0;
        long reserved = 0;
        for (Attachment attachment : attachments.findAllByRoom_Id(roomId)) {
            if (attachment.getChargedBytes() == 0 && attachment.getReservedBytes() == 0
                    && attachment.getStorageKey() != null
                    && (attachment.getState() == AttachmentState.READY || attachment.getState() == AttachmentState.LINKED
                        || attachment.getState() == AttachmentState.DELETING)) {
                attachment.setChargedBytes(attachment.getActualSizeBytes() == null
                        ? attachment.getExpectedSizeBytes() : attachment.getActualSizeBytes());
            }
            stored = Math.addExact(stored, attachment.getChargedBytes());
            reserved = Math.addExact(reserved, attachment.getReservedBytes());
        }
        quota.setStoredBytes(stored);
        quota.setReservedBytes(reserved);
        return quota;
    }

    public void queueDeletion(Attachment attachment) {
        queueKeys(attachment.getStorageKey(), attachment.getThumbnailKey());
        attachment.setState(AttachmentState.DELETING);
    }

    public void queueKeys(String... keys) {
        for (String key : keys) {
            if (key == null) continue;
            AttachmentDeleteTask task = tasks.findByStorageKey(key)
                    .orElseGet(() -> AttachmentDeleteTask.builder().storageKey(key).build());
            task.setState(AttachmentDeleteState.PENDING);
            task.setNextAttemptAt(java.time.Instant.now());
            tasks.saveAndFlush(task);
        }
    }

    public static AttachmentResponse response(Attachment attachment) {
        return AttachmentResponse.builder().publicId(attachment.getPublicId())
                .filename(attachment.getOriginalFilename()).contentType(attachment.getDetectedContentType())
                .sizeBytes(attachment.getActualSizeBytes() == null ? attachment.getExpectedSizeBytes() : attachment.getActualSizeBytes())
                .state(attachment.getState()).width(attachment.getWidthPx()).height(attachment.getHeightPx())
                .hasThumbnail(attachment.getThumbnailKey() != null).errorCode(attachment.getErrorCode())
                .expiresAt(attachment.getExpiresAt()).build();
    }
}
