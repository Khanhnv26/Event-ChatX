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
