package com.eventchat.modules.chat.service;

import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface ChatService {
    MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request);
    List<MessageResponse> getMessages(String slug, Long afterSequence);
    void postSystemMessage(Long roomId, String slug, Instant roomExpiresAt, String body, Map<String, Object> metadata);
}
