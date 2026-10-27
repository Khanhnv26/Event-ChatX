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
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final SequenceGenerator sequenceGenerator;

    @Override
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
                .sessionId(roomSession.getId())
                .guestId(roomSession.getGuestId())
                .nickname(roomSession.getNickname())
                .role(roomSession.getRole())
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

        messageRepository.save(message);

        MessageResponse response = mapToResponse(message);
        simpMessagingTemplate.convertAndSend("/topic/rooms/" + slug + "/messages", response);

        return response;
    }

    @Override
    public List<MessageResponse> getMessages(String slug, Long afterSequence) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không thấy phòng chat với code: " + slug));

        if (afterSequence != null && afterSequence > 0) {
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
                .build();
    }
}
