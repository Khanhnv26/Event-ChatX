package com.eventchat.modules.room.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.room.dto.request.CreateRoomRequest;
import com.eventchat.modules.room.dto.request.JoinRoomRequest;
import com.eventchat.modules.room.dto.request.UpdateJoinLockRequest;
import com.eventchat.modules.room.dto.response.RoomAuthResponse;
import com.eventchat.modules.room.dto.response.RoomDetailResponse;
import com.eventchat.modules.room.service.RoomAccessService;
import com.eventchat.modules.room.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final RoomAccessService roomAccessService;

    @PostMapping
    public ResponseEntity<ApiResponse<RoomAuthResponse>> createRoom(@Valid @RequestBody CreateRoomRequest request) {
        RoomAuthResponse response = roomService.createRoom(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{slug}/join")
    public ResponseEntity<ApiResponse<RoomAuthResponse>> joinRoom(
            @PathVariable String slug,
            @Valid @RequestBody JoinRoomRequest request) {
        RoomAuthResponse response = roomService.joinRoom(slug, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{slug}/close")
    public ResponseEntity<ApiResponse<Void>> closeRoom(
            @PathVariable String slug,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken) {
        roomService.closeRoom(slug, hostToken);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<RoomDetailResponse>> getRoomDetails(@PathVariable String slug,
                                                                          @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        roomAccessService.requireReadAccess(slug, sessionToken);
        RoomDetailResponse response = roomService.getRoomDetails(slug);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{slug}/reconnect")
    public ResponseEntity<ApiResponse<RoomAuthResponse>> reconnect(
            @PathVariable String slug,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken) {
        RoomAuthResponse response = roomService.reconnect(slug, sessionToken);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{slug}/join-lock")
    public ResponseEntity<ApiResponse<Void>> updateJoinLock(
            @PathVariable String slug,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken,
            @RequestBody @Valid UpdateJoinLockRequest request) {
        roomService.updateJoinLock(slug, hostToken, request.getJoinLocked());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{slug}/participants/{guestId}/kick")
    public ResponseEntity<ApiResponse<Void>> kickParticipant(
            @PathVariable String slug,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken,
            @PathVariable("guestId") String guestId) {
        roomService.kickParticipant(slug, hostToken, guestId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
