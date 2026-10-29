package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ThreadResponse;
import com.eventchat.modules.chat.dto.response.ThreadListResponse;
import com.eventchat.modules.chat.dto.response.ThreadSummaryResponse;
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
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.modules.attachment.service.impl.AttachmentLinkService;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

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
    private final RoomRepository roomRepository;
    private final AttachmentLinkService attachmentLinks;

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Không thấy session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng"));
        requireWritable(room);

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        SessionSnapshot session = sessionCacheService.getByToken(slug, room.getId(), tokenHash);

        String threadRootId = normalizeId(request.getThreadRootId());
        if (threadRootId != null) {
            requireThreadRoot(room.getId(), threadRootId);
            if (request.getAttachmentIds() != null && !request.getAttachmentIds().isEmpty()) {
                throw new IllegalArgumentException("Nhánh thảo luận hiện chỉ hỗ trợ văn bản");
            }
        }

        Optional<Message> existing = messageRepository.findByRoomIdAndClientMessageId(room.getId(), request.getClientMessageId());
        if (existing.isPresent()) {
            verifyMessageOwner(existing.get(), session);
            verifyThreadRetry(existing.get(), request);
            verifyAttachmentRetry(existing.get(), request);
            if (existing.get().getAttachments() != null && !existing.get().getAttachments().isEmpty()) {
                attachmentLinks.bind(room.getId(), session.getSessionId(), request.getClientMessageId(),
                        request.getAttachmentIds(), room.getExpiresAt().plus(Duration.ofDays(7)));
                RealtimeEventPublisher.afterCommit(simpMessagingTemplate, "/topic/room." + slug + ".messages", mapToResponse(existing.get()));
            }
            return withThreadCount(mapToResponse(existing.get()), room.getId());
        }

        ReplyInfo replyInfo = null;
        if (request.getReplyToId() != null && !request.getReplyToId().isBlank()) {
            Message replyTarget = messageRepository.findById(request.getReplyToId())
                    .orElseThrow(() -> new IllegalArgumentException("Tin nhắn được trả lời không tồn tại"));
            if (!replyTarget.getRoomId().equals(room.getId())) {
                throw new IllegalArgumentException("Tin nhắn được trả lời không thuộc cùng phòng chat");
            }
            if (!Objects.equals(threadRootId, replyTarget.getThreadRootId()) || !isPublished(replyTarget)) {
                throw new IllegalArgumentException("Chỉ được trích dẫn tin nhắn trong cùng luồng thảo luận");
            }
            String snippet = replyTarget.getBody();
            if (snippet == null || snippet.isBlank()) snippet = "Tệp đính kèm";
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
        List<AttachmentResponse> linked = request.getAttachmentIds() == null || request.getAttachmentIds().isEmpty()
                ? List.of() : attachmentLinks.bind(room.getId(), session.getSessionId(), request.getClientMessageId(), request.getAttachmentIds(), expiresAt);

        Message message = Message.builder()
                .roomId(room.getId())
                .clientMessageId(request.getClientMessageId())
                .sequence(nextSequence)
                .messageType(MessageType.TEXT)
                .sender(senderInfo)
                .body(request.getBody() == null ? "" : request.getBody())
                .attachments(linked)
                .attachmentLinkPending(!linked.isEmpty())
                .replyTo(replyInfo)
                .threadRootId(threadRootId)
                .createdAt(Instant.now())
                .expiresAt(expiresAt)
                .build();

        requireWritable(room);
        try {
            messageRepository.save(message);
        } catch (DuplicateKeyException duplicate) {
            Message committed = messageRepository.findByRoomIdAndClientMessageId(
                    room.getId(), request.getClientMessageId()).orElseThrow(() -> duplicate);
            verifyMessageOwner(committed, session);
            verifyThreadRetry(committed, request);
            verifyAttachmentRetry(committed, request);
            return withThreadCount(mapToResponse(committed), room.getId());
        }

        MessageResponse response = withThreadCount(mapToResponse(message), room.getId());

        RealtimeEventPublisher.afterCommit(simpMessagingTemplate, "/topic/room." + slug + ".messages", response);

        return response;
    }

    @Override
    public List<MessageResponse> getMessages(String slug, Long afterSequence) {
        RoomSnapshot room = roomCacheService.getBySlug(slug);

        if (afterSequence != null && afterSequence >= 0) {
            return withReplyCounts(room.getId(), messageRepository.findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(
                            room.getId(), afterSequence, PageRequest.of(0, 100))
                    .stream()
                    .filter(this::isPublished)
                    .map(this::mapToResponse)
                    .toList());
        }

        List<Message> latestMessages = messageRepository.findByRoomIdOrderBySequenceDesc(
                room.getId(), PageRequest.of(0, 50));
        List<Message> sortedMessages = new ArrayList<>(latestMessages);
        Collections.reverse(sortedMessages);

        return withReplyCounts(room.getId(), sortedMessages.stream()
                .filter(this::isPublished)
                .map(this::mapToResponse)
                .toList());
    }

    @Override
    public ThreadResponse getThread(String slug, String rootId, Long afterSequence) {
        if (afterSequence == null || afterSequence < 0) throw new IllegalArgumentException("Sequence không hợp lệ");
        RoomSnapshot room = roomCacheService.getBySlug(slug);
        Message root = requireThreadRoot(room.getId(), rootId);
        var page = messageRepository.findByRoomIdAndThreadRootIdAndSequenceGreaterThanOrderBySequenceAsc(
                room.getId(), rootId, afterSequence, PageRequest.of(0, 101));
        var items = page.stream().limit(100).map(this::mapToResponse).toList();
        MessageResponse rootResponse = mapToResponse(root);
        rootResponse.setThreadReplyCount(messageRepository.countByRoomIdAndThreadRootId(room.getId(), rootId));
        return ThreadResponse.builder().rootMessage(rootResponse).messages(items).hasMore(page.size() > 100)
                .nextSequence(items.isEmpty() ? afterSequence : items.getLast().getSequence()).build();
    }

    @Override
    public ThreadListResponse getThreads(String slug, Long beforeActivitySequence) {
        if (beforeActivitySequence != null && beforeActivitySequence <= 0) throw new IllegalArgumentException("Cursor không hợp lệ");
        RoomSnapshot room = roomCacheService.getBySlug(slug);
        var activities = messageRepository.findThreadActivities(room.getId(), beforeActivitySequence == null ? Long.MAX_VALUE : beforeActivitySequence);
        var page = activities.stream().limit(50).toList();
        var roots = new HashMap<String, Message>();
        if (!page.isEmpty()) messageRepository.findByRoomIdAndIdIn(room.getId(), page.stream().map(a -> a.getId()).toList())
                .forEach(root -> roots.put(root.getId(), root));
        var summaries = new ArrayList<ThreadSummaryResponse>();
        for (var activity : page) {
            Message root = roots.get(activity.getId());
            if (root == null || root.getThreadRootId() != null || root.getMessageType() != MessageType.TEXT || !isPublished(root)) continue;
            var response = mapToResponse(root);
            response.setThreadReplyCount(activity.getReplyCount());
            String snippet = activity.getLastReplySnippet();
            if (snippet != null && snippet.length() > 160) snippet = snippet.substring(0, 160) + "…";
            summaries.add(ThreadSummaryResponse.builder().rootMessage(response).replyCount(activity.getReplyCount())
                    .lastActivityAt(activity.getLastActivityAt()).lastActivitySequence(activity.getLastActivitySequence())
                    .lastReplySnippet(snippet).build());
        }
        return ThreadListResponse.builder().threads(summaries).hasMore(activities.size() > 50)
                .nextActivitySequence(page.isEmpty() ? null : page.getLast().getLastActivitySequence()).build();
    }

    private Message requireThreadRoot(Long roomId, String rootId) {
        Message root = messageRepository.findById(rootId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin gốc"));
        if (!Objects.equals(roomId, root.getRoomId()) || root.getThreadRootId() != null
                || root.getMessageType() != MessageType.TEXT || !isPublished(root)) {
            throw new IllegalArgumentException("Tin gốc không hợp lệ trong phòng này");
        }
        return root;
    }

    private String normalizeId(String id) { return id == null || id.isBlank() ? null : id; }

    private void verifyThreadRetry(Message message, SendMessageRequest request) {
        if (!Objects.equals(message.getThreadRootId(), normalizeId(request.getThreadRootId()))
                || message.getThreadRootId() != null && (!Objects.equals(message.getBody(), request.getBody())
                || !Objects.equals(message.getReplyTo() == null ? null : message.getReplyTo().getMessageId(), normalizeId(request.getReplyToId())))) {
            throw new com.eventchat.common.exception.AttachmentConflictException("Mã tin nhắn đã được dùng cho nội dung hoặc nhánh khác");
        }
    }

    private MessageResponse withThreadCount(MessageResponse response, Long roomId) {
        if (response.getThreadRootId() != null) response.setThreadReplyCount(
                messageRepository.countByRoomIdAndThreadRootId(roomId, response.getThreadRootId()));
        return response;
    }

    private List<MessageResponse> withReplyCounts(Long roomId, List<MessageResponse> responses) {
        if (responses.isEmpty()) return responses;
        var counts = messageRepository.countThreadReplies(roomId, responses.stream().map(MessageResponse::getId).toList());
        var byRoot = new HashMap<String, Long>();
        counts.forEach(count -> byRoot.put(count.getId(), count.getCount()));
        responses.forEach(response -> response.setThreadReplyCount(byRoot.getOrDefault(response.getId(), 0L)));
        return responses;
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

    private boolean isPublished(Message message) {
        return message.getAttachments() == null || message.getAttachments().isEmpty()
                || attachmentLinks.published(message.getRoomId(), message.getClientMessageId(), message.getAttachments());
    }

    private void verifyAttachmentRetry(Message message, SendMessageRequest request) {
        List<String> prior = message.getAttachments() == null ? List.of() : message.getAttachments().stream()
                .map(AttachmentResponse::getPublicId).toList();
        List<String> next = request.getAttachmentIds() == null ? List.of() : request.getAttachmentIds();
        // Preserve compatibility with legacy text-only retries, validate attachment payloads strictly.
        if ((!prior.isEmpty() || !next.isEmpty()) && (!prior.equals(next)
                || !Objects.equals(message.getBody(), request.getBody() == null ? "" : request.getBody())
                || !Objects.equals(message.getReplyTo() == null ? null : message.getReplyTo().getMessageId(), request.getReplyToId()))) {
            throw new com.eventchat.common.exception.AttachmentConflictException("Client message ID đã được dùng với nội dung khác");
        }
    }

    private void requireWritable(Room room) {
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !Instant.now().isBefore(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng chat đã đóng hoặc hết hạn");
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
                .threadRootId(message.getThreadRootId())
                .createdAt(message.getCreatedAt())
                .metadata(message.getMetadata())
                .attachments(message.getAttachments() == null ? List.of() : message.getAttachments())
                .build();
    }
}
