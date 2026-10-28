package com.eventchat.infrastructure.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.*;
import org.springframework.messaging.support.ExecutorChannelInterceptor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StompOutboundGuard implements ExecutorChannelInterceptor {
    private final RealtimeSessionRegistry registry;

    @Override
    public Message<?> beforeHandle(Message<?> message, MessageChannel channel, MessageHandler handler) {
        if (SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) != SimpMessageType.MESSAGE) return message;
        String socketId = SimpMessageHeaderAccessor.getSessionId(message.getHeaders());
        if (socketId == null || !registry.valid(socketId)) {
            if (socketId != null) registry.close(socketId);
            return null;
        }
        return message;
    }
}
