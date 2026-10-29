package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.service.impl.AttachmentLinkService;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
public class AttachmentMessageReconciler {
    private final MessageRepository messages;
    private final RoomRepository rooms;
    private final AttachmentLinkService links;
    private final SimpMessagingTemplate broker;
    private final TransactionTemplate transactions;

    public AttachmentMessageReconciler(MessageRepository messages, RoomRepository rooms, AttachmentLinkService links,
            SimpMessagingTemplate broker, PlatformTransactionManager manager) {
        this.messages = messages;
        this.rooms = rooms;
        this.links = links;
        this.broker = broker;
        this.transactions = new TransactionTemplate(manager);
    }

    @Scheduled(fixedDelayString = "${app.upload.reconcile-delay-ms:5000}")
    public synchronized void reconcile() {
        try {
            for (Message pending : messages.findTop25ByAttachmentLinkPendingTrueOrderByCreatedAtAsc()) {
                try {
                    String slug = transactions.execute(status -> {
                        Room room = rooms.findById(pending.getRoomId()).orElse(null);
                        if (room == null) return null;
                        room = rooms.findBySlugForUpdate(room.getSlug()).orElseThrow();
                        if (!links.published(room.getId(), pending.getClientMessageId(), pending.getAttachments())) {
                            if (room.getRoomStatus() != RoomStatus.ACTIVE || !room.getExpiresAt().isAfter(Instant.now())) return null;
                            links.bind(room.getId(), pending.getSender().getSessionId(), pending.getClientMessageId(),
                                    pending.getAttachments().stream().map(AttachmentResponse::getPublicId).toList(), pending.getExpiresAt());
                        }
                        return room.getSlug();
                    });
                    pending.setAttachmentLinkPending(false);
                    messages.save(pending);
                    if (slug != null) {
                        MessageResponse response = MessageResponse.builder().id(pending.getId()).clientMessageId(pending.getClientMessageId())
                                .sequence(pending.getSequence()).senderGuestId(pending.getSender().getGuestId())
                                .senderNickname(pending.getSender().getNickname()).body(pending.getBody()).messageType(pending.getMessageType())
                                .replyToId(pending.getReplyTo() == null ? null : pending.getReplyTo().getMessageId())
                                .createdAt(pending.getCreatedAt()).attachments(pending.getAttachments()).metadata(pending.getMetadata()).build();
                        RealtimeEventPublisher.afterCommit(broker, "/topic/room." + slug + ".messages", response);
                    }
                } catch (com.eventchat.common.exception.AttachmentConflictException | SecurityException ex) {
                    // The user can no longer complete this abandoned cross-store write. Never expose it in history.
                    pending.setAttachmentLinkPending(false);
                    messages.save(pending);
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Attachment message reconciliation deferred: {}", ex.getClass().getSimpleName());
        }
    }
}
