package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;

    @Override
    @Transactional
    public MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request) {
        if (rawSessionToken == null || rawSessionToken.isEmpty()) {
            throw new IllegalArgumentException("Không thấy session token");
        }
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không thấy phòng chat với code: " + slug));

        if (room.getRoomStatus() != RoomStatus.ACTIVE || Instant.now().isAfter(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng chat đã đóng");
        }

        String tokenHash = TokenUtil.sha256(rawSessionToken);

        RoomSession roomSession = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên tham gia không hợp lệ"));

        Optional<Message> existing = messageRepository.findByRoomIdAndClientMessageId(room.getId(), request.getClientMessageId());
        if (existing.isPresent()) {
            return maptoResponse(existing.get());
        }

        Message replyTo = null;
        if (request.getReplyToId() != null) {
            replyTo = messageRepository.findById(request.getReplyToId()).orElseThrow(()
                    -> new IllegalArgumentException("Tin nhắn được trả lời không tồn tại"));
            if (!replyTo.getRoom().getId().equals(room.getId())) {
                throw new IllegalArgumentException("Tin nhắn được trả lời không thuộc cùng phòng chat");
            }
        }

        Long nextSequence = messageRepository.findMaxSequenceByRoomId(room.getId()) + 1;
        Message message = Message.builder()
                .room(room)
                .authorSession(roomSession)
                .clientMessageId(request.getClientMessageId())
                .sequence(nextSequence)
                .messageType(MessageType.TEXT)
                .body(request.getBody())
                .replyTo(replyTo)
                .build();
        messageRepository.save(message);

        MessageResponse response = maptoResponse(message);
        simpMessagingTemplate.convertAndSend("/topic/rooms/" + slug + "/messages", response);

        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponse> getMessages(String slug, Long afterSequence) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không thấy phòng chat với code: " + slug));

        if (afterSequence != null && afterSequence > 0) {
            return messageRepository.findAllByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(room.getId(), afterSequence)
                    .stream()
                    .map(this::maptoResponse)
                    .toList();
        }

        return messageRepository.findAllByRoomIdOrderBySequenceAsc(room.getId())
                .stream()
                .map(this::maptoResponse)
                .toList();
    }

    private MessageResponse maptoResponse(Message message) {
        return MessageResponse.builder()
                .id(message.getId())
                .clientMessageId(message.getClientMessageId())
                .sequence(message.getSequence())
                .senderGuestId(message.getAuthorSession() != null ? message.getAuthorSession().getGuestId() : null)
                .senderNickname(message.getAuthorSession() != null ? message.getAuthorSession().getNickname() : "Hệ thống")
                .messageType(message.getMessageType())
                .body(message.getBody())
                .replyToId(message.getReplyTo() != null ? message.getReplyTo().getId() : null)
                .createdAt(message.getCreatedAt())
                .build();
    }
}
