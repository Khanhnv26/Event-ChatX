package com.eventchat.modules.chat.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.chat.dto.request.PinMessageRequest;
import com.eventchat.modules.chat.dto.request.SetReactionRequest;
import com.eventchat.modules.chat.dto.response.MessageInteractionsResponse;
import com.eventchat.modules.chat.service.MessageInteractionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms/{slug}/messages")
@RequiredArgsConstructor
public class MessageInteractionController {
    private final MessageInteractionService interactions;

    @GetMapping("/interactions")
    public ResponseEntity<ApiResponse<MessageInteractionsResponse>> getInteractions(@PathVariable String slug,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestParam(required = false) List<String> messageIds) {
        return ResponseEntity.ok(ApiResponse.success(interactions.getInteractions(
                slug, sessionToken, messageIds == null ? List.of() : messageIds)));
    }

    @PutMapping("/{messageId}/reactions")
    public ResponseEntity<Void> setReaction(@PathVariable String slug, @PathVariable String messageId,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @Valid @RequestBody SetReactionRequest request) {
        interactions.setReaction(slug, sessionToken, messageId, request.getEmoji(), request.getActive());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/pin")
    public ResponseEntity<Void> pin(@PathVariable String slug,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken,
            @Valid @RequestBody PinMessageRequest request) {
        interactions.pin(slug, hostToken, request.getMessageId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/pin")
    public ResponseEntity<Void> unpin(@PathVariable String slug,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken) {
        interactions.unpin(slug, hostToken);
        return ResponseEntity.noContent().build();
    }
}
