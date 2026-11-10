package com.eventchat.modules.ai.service;

import com.eventchat.common.event.AiPromptRequested;

public interface AiAssistantService {
    void enqueue(AiPromptRequested request);
}
