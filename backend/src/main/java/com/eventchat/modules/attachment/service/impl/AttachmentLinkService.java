package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AttachmentLinkService {
    private final AttachmentRepository attachments;
    private final RoomSessionRepository sessions;

    // Called inside the chat transaction, after its Room lock.
    public List<AttachmentResponse> bind(Long roomId, Long sessionId, String clientMessageId,
                                         List<String> ids, Instant expiresAt) {
        if (ids == null || ids.isEmpty()) return List.of();
        if (ids.size() > 4 || new HashSet<>(ids).size() != ids.size()) throw new IllegalArgumentException("Danh sách tệp không hợp lệ");
        if (!sessions.existsByIdAndRoomIdAndRevokedAtIsNull(sessionId, roomId)) throw new SecurityException("Phiên đã bị thu hồi");
        List<AttachmentResponse> result = new ArrayList<>();
        for (String id : ids) {
            Attachment attachment = attachments.findForUpdate(roomId, id)
                    .orElseThrow(() -> new SecurityException("Không có quyền dùng tệp"));
            if (!sessionId.equals(attachment.getUploaderSessionId())) throw new SecurityException("Chỉ được gửi tệp của chính bạn");
            boolean sameMessage = clientMessageId.equals(attachment.getBoundClientMessageId());
            if (!attachment.getExpiresAt().isAfter(Instant.now()) || attachment.getState() != AttachmentState.READY
                    && !(attachment.getState() == AttachmentState.LINKED && sameMessage)) {
                throw new AttachmentConflictException("Tệp chưa sẵn sàng hoặc đã được dùng trong tin nhắn khác");
            }
            attachment.setBoundClientMessageId(clientMessageId);
            attachment.setState(AttachmentState.LINKED);
            attachment.setExpiresAt(expiresAt);
            result.add(AttachmentLifecycleService.response(attachment));
        }
        return result;
    }

    public boolean published(Long roomId, String clientMessageId, List<AttachmentResponse> snapshots) {
        if (snapshots == null || snapshots.isEmpty()) return true;
        return snapshots.stream().allMatch(snapshot -> attachments.findByRoom_IdAndPublicId(roomId, snapshot.getPublicId())
                .filter(value -> value.getState() == AttachmentState.LINKED && clientMessageId.equals(value.getBoundClientMessageId())).isPresent());
    }
}
