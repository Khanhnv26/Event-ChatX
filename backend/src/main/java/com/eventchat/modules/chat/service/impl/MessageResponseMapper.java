package com.eventchat.modules.chat.service.impl;

import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.entity.Message;

import java.util.List;

final class MessageResponseMapper {
    private MessageResponseMapper() {
    }

    static MessageResponse mapToResponse(Message message) {
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
