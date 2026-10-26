package com.eventchat.modules.chat.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms/{slug}/messages")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ResponseEntity<ApiResponse<MessageResponse>>sendMessage(@PathVariable String slug,
                                                       @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                                       @RequestBody @Valid SendMessageRequest request) {

        return ResponseEntity.ok(ApiResponse.success(chatService.sendMessage(slug, sessionToken, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MessageResponse>>>getMessages(@PathVariable String slug,
                                                       @RequestParam(value = "afterSequence", required = false) Long afterSequence) {
        return ResponseEntity.ok(ApiResponse.success(chatService.getMessages(slug, afterSequence)));
    }
}
