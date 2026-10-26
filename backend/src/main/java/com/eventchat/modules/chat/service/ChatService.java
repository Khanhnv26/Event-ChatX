package com.eventchat.modules.chat.service;

import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;

import java.util.List;

public interface ChatService {
    MessageResponse sendMessage(String slug, String rawSessionToken, SendMessageRequest request);
    List<MessageResponse> getMessages(String slug, Long afterSequence);
}
