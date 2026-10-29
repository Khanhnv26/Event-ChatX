package com.eventchat.modules.chat.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ThreadResponse;
import com.eventchat.modules.chat.dto.response.ThreadListResponse;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.room.service.RoomAccessService;
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
    private final RoomAccessService roomAccessService;

    @PostMapping
    public ResponseEntity<ApiResponse<MessageResponse>>sendMessage(@PathVariable String slug,
                                                       @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                                       @RequestBody @Valid SendMessageRequest request) {

        return ResponseEntity.ok(ApiResponse.success(chatService.sendMessage(slug, sessionToken, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MessageResponse>>>getMessages(@PathVariable String slug,
                                                                         @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                                                         @RequestParam(value = "afterSequence", required = false) Long afterSequence) {
        roomAccessService.requireReadAccess(slug, sessionToken);
        return ResponseEntity.ok(ApiResponse.success(chatService.getMessages(slug, afterSequence)));
    }

    @GetMapping("/{rootId}/thread")
    public ResponseEntity<ApiResponse<ThreadResponse>> getThread(
            @PathVariable String slug, @PathVariable String rootId,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestParam(value = "afterSequence", defaultValue = "0") Long afterSequence) {
        roomAccessService.requireReadAccess(slug, sessionToken);
        return ResponseEntity.ok(ApiResponse.success(chatService.getThread(slug, rootId, afterSequence)));
    }

    @GetMapping("/threads")
    public ResponseEntity<ApiResponse<ThreadListResponse>> getThreads(@PathVariable String slug,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestParam(value = "beforeActivitySequence", required = false) Long beforeActivitySequence) {
        roomAccessService.requireReadAccess(slug, sessionToken);
        return ResponseEntity.ok(ApiResponse.success(chatService.getThreads(slug, beforeActivitySequence)));
    }
}
