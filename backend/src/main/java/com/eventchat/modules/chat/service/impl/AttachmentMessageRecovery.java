package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.common.exception.AttachmentConflictException;
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

import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
public class AttachmentMessageRecovery {
    private final MessageRepository messages;
    private final RoomRepository rooms;
    private final AttachmentLinkService links;
    private final SimpMessagingTemplate broker;
    private final TransactionTemplate transactions;

    public AttachmentMessageRecovery(MessageRepository messages, RoomRepository rooms, AttachmentLinkService links,
                                     SimpMessagingTemplate broker, PlatformTransactionManager transactionManager) {
        this.messages = messages;
        this.rooms = rooms;
        this.links = links;
        this.broker = broker;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${app.upload.recovery-delay-ms:5000}")
    public synchronized void recover() {
        try {
            for (Message message : messages.findTop25ByAttachmentLinkPendingTrueOrderByCreatedAtAsc()) {
                try {
                    String slug = transactions.execute(status -> {
                        Room room = rooms.findById(message.getRoomId()).orElse(null);
                        if (room == null || message.getSender() == null || message.getAttachments() == null) return null;
                        room = rooms.findBySlugForUpdate(room.getSlug()).orElseThrow();
                        if (!links.published(room.getId(), message.getClientMessageId(), message.getAttachments())) {
                            if (room.getRoomStatus() != RoomStatus.ACTIVE || !room.getExpiresAt().isAfter(Instant.now())) return null;
                            links.bind(room.getId(), message.getSender().getSessionId(), message.getClientMessageId(),
                                    message.getAttachments().stream().map(AttachmentResponse::getPublicId).toList(),
                                    room.getExpiresAt().plus(Duration.ofDays(7)));
                        }
                        return room.getSlug();
                    });
                    // This Mongo flag changes only after the SQL transaction has committed.
                    message.setAttachmentLinkPending(false);
                    messages.save(message);
                    if (slug != null) {
                        MessageResponse response = MessageResponse.builder().id(message.getId()).clientMessageId(message.getClientMessageId())
                                .sequence(message.getSequence()).senderGuestId(message.getSender().getGuestId())
                                .senderNickname(message.getSender().getNickname()).messageType(message.getMessageType())
                                .body(message.getBody()).replyToId(message.getReplyTo() == null ? null : message.getReplyTo().getMessageId())
                                .attachments(message.getAttachments()).metadata(message.getMetadata()).createdAt(message.getCreatedAt()).build();
                        RealtimeEventPublisher.afterCommit(broker, "/topic/room." + slug + ".messages", response);
                    }
                } catch (AttachmentConflictException | SecurityException ex) {
                    message.setAttachmentLinkPending(false);
                    messages.save(message);
                } catch (RuntimeException ex) {
                    log.warn("Message attachment recovery deferred: id={}, reason={}", message.getId(), ex.getClass().getSimpleName());
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Cannot read pending attachment messages: {}", ex.getClass().getSimpleName());
        }
    }
}
