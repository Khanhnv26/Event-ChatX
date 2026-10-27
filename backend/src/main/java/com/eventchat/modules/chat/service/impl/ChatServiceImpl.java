package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.entity.ReplyInfo;
import com.eventchat.modules.chat.entity.SenderInfo;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.chat.service.SequenceGenerator;
import com.eventchat.modules.room.cache.RoomSnapshot;
import com.eventchat.modules.room.cache.SessionSnapshot;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.room.service.SessionCacheService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final SequenceGenerator sequenceGenerator;
    private final RoomCacheService roomCacheService;
    private final SessionCacheService sessionCacheService;

    @Override
    public MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request) {
        if (rawSessionToken == null || rawSessionToken.isEmpty()) {
            throw new IllegalArgumentException("Không thấy session token");
        }

        RoomSnapshot room = roomCacheService.getBySlug(slug);
        if (!room.isWritable()) {
            throw new IllegalArgumentException("Phòng chat đã đóng");
        }

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        SessionSnapshot session = sessionCacheService.getByToken(slug, room.getId(), tokenHash);

        Optional<Message> existing = messageRepository.findByRoomIdAndClientMessageId(room.getId(), request.getClientMessageId());
        if (existing.isPresent()) {
            verifyMessageOwner(existing.get(), session);
            return mapToResponse(existing.get());
        }

        ReplyInfo replyInfo = null;
        if (request.getReplyToId() != null && !request.getReplyToId().isBlank()) {
            Message replyTarget = messageRepository.findById(request.getReplyToId())
                    .orElseThrow(() -> new IllegalArgumentException("Tin nhắn được trả lời không tồn tại"));
            if (!replyTarget.getRoomId().equals(room.getId())) {
                throw new IllegalArgumentException("Tin nhắn được trả lời không thuộc cùng phòng chat");
            }
            String snippet = replyTarget.getBody();
            if (snippet.length() > 100) {
                snippet = snippet.substring(0, 100) + "...";
            }
            replyInfo = ReplyInfo.builder()
                    .messageId(replyTarget.getId())
                    .sequence(replyTarget.getSequence())
                    .senderNickname(replyTarget.getSender() != null ? replyTarget.getSender().getNickname() : "Hệ thống")
                    .snippet(snippet)
                    .build();
        }

        Long nextSequence = sequenceGenerator.next(room.getId(), room.getExpiresAt());

        SenderInfo senderInfo = SenderInfo.builder()
                .sessionId(session.getSessionId())
                .guestId(session.getGuestId())
                .nickname(session.getNickname())
                .role(session.getRole())
                .build();

        Instant expiresAt = room.getExpiresAt().plus(Duration.ofDays(7));

        Message message = Message.builder()
                .roomId(room.getId())
                .clientMessageId(request.getClientMessageId())
                .sequence(nextSequence)
                .messageType(MessageType.TEXT)
                .sender(senderInfo)
                .body(request.getBody())
                .replyTo(replyInfo)
                .createdAt(Instant.now())
                .expiresAt(expiresAt)
                .build();

        try {
            messageRepository.save(message);
        } catch (DuplicateKeyException duplicate) {
            Message committed = messageRepository.findByRoomIdAndClientMessageId(
                    room.getId(), request.getClientMessageId()).orElseThrow(() -> duplicate);
            verifyMessageOwner(committed, session);
            return mapToResponse(committed);
        }

        MessageResponse response = mapToResponse(message);

        try {
            simpMessagingTemplate.convertAndSend("/topic/room." + slug + ".messages", response);
        } catch (Exception ignored) {
        }

        return response;
    }

    @Override
    public List<MessageResponse> getMessages(String slug, Long afterSequence) {
        RoomSnapshot room = roomCacheService.getBySlug(slug);

        if (afterSequence != null && afterSequence >= 0) {
            return messageRepository.findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(
                            room.getId(), afterSequence, PageRequest.of(0, 100))
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        List<Message> latestMessages = messageRepository.findByRoomIdOrderBySequenceDesc(
                room.getId(), PageRequest.of(0, 50));
        List<Message> sortedMessages = new ArrayList<>(latestMessages);
        Collections.reverse(sortedMessages);

        return sortedMessages.stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    public void postSystemMessage(Long roomId, String slug, Instant roomExpiresAt, String body, Map<String, Object> metadata) {
        Long seq = sequenceGenerator.next(roomId, roomExpiresAt);
        Message msg = Message.builder()
                .roomId(roomId)
                .clientMessageId("sys-" + UUID.randomUUID().toString())
                .sequence(seq)
                .messageType(MessageType.SYSTEM)
                .sender(null)
                .replyTo(null)
                .body(body)
                .metadata(metadata)
                .createdAt(Instant.now())
                .expiresAt(roomExpiresAt.plus(Duration.ofDays(7)))
                .build();
        messageRepository.save(msg);
        try {
            simpMessagingTemplate.convertAndSend("/topic/room." + slug + ".messages", mapToResponse(msg));
        } catch (Exception ignored) {
        }
    }

    private void verifyMessageOwner(Message message, SessionSnapshot session) {
        if (message.getSender() == null || !Objects.equals(message.getSender().getSessionId(), session.getSessionId())) {
            throw new IllegalArgumentException("Mã tin nhắn đã được sử dụng bởi phiên khác");
        }
    }

    private MessageResponse mapToResponse(Message message) {
        return MessageResponse.builder()
                .id(message.getId())
                .clientMessageId(message.getClientMessageId())
                .sequence(message.getSequence())
                .senderGuestId(message.getSender() != null ? message.getSender().getGuestId() : null)
                .senderNickname(message.getSender() != null ? message.getSender().getNickname() : "Hệ thống")
                .messageType(message.getMessageType())
                .body(message.getBody())
                .replyToId(message.getReplyTo() != null ? message.getReplyTo().getMessageId() : null)
                .createdAt(message.getCreatedAt())
                .metadata(message.getMetadata())
                .build();
    }
}
