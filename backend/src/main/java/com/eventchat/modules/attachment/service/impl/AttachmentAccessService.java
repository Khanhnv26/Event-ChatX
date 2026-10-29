package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentStorageException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.service.StorageService;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.io.IOException;

@Service
@RequiredArgsConstructor
public class AttachmentAccessService {
    private final RoomRepository rooms;
    private final RoomSessionRepository sessions;
    private final AttachmentRepository attachments;
    private final AttachmentLifecycleService lifecycle;
    private final StorageService storage;

    @Transactional(readOnly = true)
    public AttachmentDownload openContent(String slug, String token, String publicId, boolean thumbnail) {
        Attachment attachment = download(slug, token, publicId);
        String key = thumbnail ? attachment.getThumbnailKey() : attachment.getStorageKey();
        if (key == null) throw new AttachmentConflictException("Tệp không có nội dung yêu cầu");
        String contentType = thumbnail ? "image/jpeg" : attachment.getDetectedContentType();
        try {
            return new AttachmentDownload(attachment.getOriginalFilename(), contentType,
                    contentType.startsWith("image/"), storage.open(key));
        } catch (IOException ex) {
            throw new AttachmentStorageException(ex);
        }
    }

    @Transactional(readOnly = true)
    public AttachmentResponse status(String slug, String token, String publicId) {
        return AttachmentLifecycleService.response(requireAccess(slug, token, publicId, false));
    }

    @Transactional(readOnly = true)
    public Attachment download(String slug, String token, String publicId) {
        Attachment attachment = requireAccess(slug, token, publicId, false);
        if (attachment.getState() != AttachmentState.READY && attachment.getState() != AttachmentState.LINKED) {
            throw new AttachmentConflictException("Tệp chưa sẵn sàng hoặc đã bị hủy");
        }
        return attachment;
    }

    @Transactional
    public void cancel(String slug, String token, String publicId) {
        // Room first, matching upload and chat lock order.
        rooms.findBySlugForUpdate(slug).orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        Attachment allowed = requireAccess(slug, token, publicId, true);
        Attachment attachment = attachments.findForUpdate(allowed.getRoom().getId(), publicId).orElseThrow();
        if (attachment.getState() == AttachmentState.LINKING || attachment.getState() == AttachmentState.LINKED) {
            throw new AttachmentConflictException("Không thể hủy tệp đã gắn vào tin nhắn");
        }
        lifecycle.queueDeletion(attachment);
    }

    private Attachment requireAccess(String slug, String token, String publicId, boolean ownerOnly) {
        if (token == null || token.isBlank()) throw new SecurityException("Thiếu phiên tham gia phòng");
        Room room = rooms.findBySlug(slug).orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(token))
                .orElseThrow(() -> new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ"));
        Attachment attachment = attachments.findByRoom_IdAndPublicId(room.getId(), publicId)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập tệp"));
        boolean uploader = session.getId().equals(attachment.getUploaderSessionId());
        if (!uploader && (ownerOnly || attachment.getState() != AttachmentState.LINKED)) {
            throw new SecurityException("Tệp chưa được chia sẻ trong phòng");
        }
        if (!attachment.getExpiresAt().isAfter(Instant.now())) throw new AttachmentConflictException("Tệp đã hết hạn");
        return attachment;
    }
}
