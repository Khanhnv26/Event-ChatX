package com.eventchat.modules.chat.service;

import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ThreadResponse;
import com.eventchat.modules.chat.dto.response.ThreadListResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface ChatService {
    ThreadListResponse getThreads(String slug, Long beforeActivitySequence);
    ThreadResponse getThread(String slug, String rootId, Long afterSequence);
    MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request);
    List<MessageResponse> getMessages(String slug, Long afterSequence);
    void postSystemMessage(Long roomId, String slug, Instant roomExpiresAt, String body, Map<String, Object> metadata);
}
