package com.eventchat.modules.chat.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@AllArgsConstructor
public class MessageInteractionsResponse {
    private final MessageResponse pinnedMessage;
    private final Map<String, List<ReactionResponse>> reactions;
}
