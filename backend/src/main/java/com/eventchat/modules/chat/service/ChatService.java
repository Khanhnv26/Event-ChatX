package com.eventchat.modules.chat.service;

import com.eventchat.common.event.AiPromptRequested;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ThreadResponse;
import com.eventchat.modules.chat.dto.response.ThreadListResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ChatService {
    Optional<MessageResponse> findPublishedMessage(Long roomId, String messageId);
    ThreadListResponse getThreads(String slug, Long beforeActivitySequence);
    ThreadResponse getThread(String slug, String rootId, Long afterSequence);
    MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request);
    void publishTyping(String slug, String rawSessionToken);
    List<MessageResponse> getMessages(String slug, Long afterSequence);
    void postSystemMessage(Long roomId, String slug, Instant roomExpiresAt, String body, Map<String, Object> metadata);
    List<AiContextLine> getAiContext(AiPromptRequested request, int limit);
    void postAiReply(AiPromptRequested request, String body, Map<String, Object> metadata);

    record AiContextLine(String messageId, String speaker, String text) {}
}
