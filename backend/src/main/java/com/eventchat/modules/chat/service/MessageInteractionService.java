package com.eventchat.modules.chat.service;

import com.eventchat.modules.chat.dto.response.MessageInteractionsResponse;
import com.eventchat.modules.chat.enums.ReactionEmoji;

import java.util.List;

public interface MessageInteractionService {
    MessageInteractionsResponse getInteractions(String slug, String sessionToken, List<String> messageIds);
    void setReaction(String slug, String sessionToken, String messageId, ReactionEmoji emoji, boolean active);
    void pin(String slug, String hostToken, String messageId);
    void unpin(String slug, String hostToken);
}
