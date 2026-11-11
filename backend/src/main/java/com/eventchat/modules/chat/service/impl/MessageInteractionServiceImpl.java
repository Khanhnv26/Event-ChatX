package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.modules.chat.dto.response.MessageInteractionsResponse;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ReactionResponse;
import com.eventchat.modules.chat.entity.MessageReaction;
import com.eventchat.modules.chat.entity.RoomMessagePin;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.chat.enums.ReactionEmoji;
import com.eventchat.modules.chat.repository.MessageReactionRepository;
import com.eventchat.modules.chat.repository.MessageReactionRepository.ReactionAggregate;
import com.eventchat.modules.chat.repository.RoomMessagePinRepository;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.chat.service.MessageInteractionService;
import com.eventchat.modules.room.cache.SessionSnapshot;
import com.eventchat.modules.room.service.RoomAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageInteractionServiceImpl implements MessageInteractionService {
    private final ChatService chat;
    private final RoomAccessService roomAccess;
    private final MessageReactionRepository reactions;
    private final RoomMessagePinRepository pins;
    private final SimpMessagingTemplate broker;

    @Override
    @Transactional(readOnly = true)
    public MessageInteractionsResponse getInteractions(String slug, String sessionToken, List<String> messageIds) {
        if (messageIds.size() > 100 || messageIds.stream().anyMatch(id -> id.isBlank() || id.length() > 64)) {
            throw new IllegalArgumentException("Danh sách mã tin nhắn không hợp lệ");
        }
        SessionSnapshot session = roomAccess.readSession(slug, sessionToken);
        Long roomId = session.getRoomId();
        Map<String, List<ReactionResponse>> summary = new HashMap<>();
        if (!messageIds.isEmpty()) {
            for (ReactionAggregate row : reactions.summarize(roomId, session.getSessionId(), messageIds)) {
                summary.computeIfAbsent(row.getMessageId(), ignored -> new ArrayList<>())
                        .add(new ReactionResponse(row.getEmoji(), row.getTotal(), row.getOwnCount() > 0));
            }
        }
        MessageResponse pinned = pins.findById(roomId)
                .flatMap(pin -> chat.findPublishedMessage(roomId, pin.getMessageId())).orElse(null);
        return new MessageInteractionsResponse(pinned, summary);
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void setReaction(String slug, String sessionToken, String messageId, ReactionEmoji emoji, boolean active) {
        SessionSnapshot session = roomAccess.lockWritableSession(slug, sessionToken);
        Long roomId = session.getRoomId();
        requireMessage(roomId, messageId);
        Optional<MessageReaction> current = reactions.findByRoomIdAndMessageIdAndSessionIdAndEmoji(
                roomId, messageId, session.getSessionId(), emoji);
        if (current.isPresent() == active) return;
        if (active) {
            reactions.save(MessageReaction.builder().roomId(roomId).messageId(messageId)
                    .sessionId(session.getSessionId()).emoji(emoji).build());
        } else {
            current.ifPresent(reactions::delete);
        }
        broadcast(slug, Map.of("type", "REACTIONS_CHANGED", "messageId", messageId));
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void pin(String slug, String hostToken, String messageId) {
        Long roomId = roomAccess.lockWritableRoomForHost(slug, hostToken);
        MessageResponse message = requireMessage(roomId, messageId);
        Optional<RoomMessagePin> current = pins.findById(roomId);
        if (current.filter(pin -> messageId.equals(pin.getMessageId())).isPresent()) return;
        pins.save(new RoomMessagePin(roomId, messageId));
        Map<String, Object> event = new HashMap<>(Map.of("type", "MESSAGE_PIN_CHANGED",
                "messageId", messageId, "eventId", UUID.randomUUID().toString()));
        if (message.getSequence() != null) event.put("sequence", message.getSequence());
        if (message.getThreadRootId() != null) event.put("threadRootId", message.getThreadRootId());
        broadcast(slug, event);
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void unpin(String slug, String hostToken) {
        Long roomId = roomAccess.lockWritableRoomForHost(slug, hostToken);
        Optional<RoomMessagePin> current = pins.findById(roomId);
        if (current.isEmpty()) return;
        pins.delete(current.get());
        broadcast(slug, Map.of("type", "MESSAGE_PIN_CHANGED"));
    }

    private MessageResponse requireMessage(Long roomId, String messageId) {
        return chat.findPublishedMessage(roomId, messageId)
                .filter(message -> message.getMessageType() == MessageType.TEXT || message.getMessageType() == MessageType.AI_BOT)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin nhắn tương tác trong phòng"));
    }

    private void broadcast(String slug, Map<String, ?> event) {
        RealtimeEventPublisher.afterCommit(broker, "/topic/room." + slug + ".events", event);
    }
}
