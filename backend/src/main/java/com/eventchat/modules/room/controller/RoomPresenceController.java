package com.eventchat.modules.room.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.infrastructure.websocket.RoomPresenceService;
import com.eventchat.modules.room.service.RoomAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/presence")
public class RoomPresenceController {
    private final RoomAccessService access;
    private final RoomPresenceService presence;

    @GetMapping
    public ApiResponse<Set<String>> online(@PathVariable String slug,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        access.requireReadAccess(slug, token);
        return ApiResponse.success(presence.online(slug));
    }
}
