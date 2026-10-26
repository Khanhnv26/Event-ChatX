package com.eventchat.modules.interaction.wheel.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.interaction.wheel.dto.request.CreateWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.request.SpinWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.response.WheelResponse;
import com.eventchat.modules.interaction.wheel.dto.response.WheelSpinResponse;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/wheels")
public class WheelController {

    private final WheelService wheelService;

    @PostMapping
    public ResponseEntity<ApiResponse<WheelResponse>> createWheel(@PathVariable String slug,
                                                                  @RequestHeader("X-Session-Token") String sessionToken,
                                                                  @RequestBody @Valid CreateWheelRequest request) {
        WheelResponse wheelResponse = wheelService.createWheel(slug, sessionToken, request);
        return ResponseEntity.ok(ApiResponse.success(wheelResponse));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<WheelResponse>>> getWheel(@PathVariable String slug) {
        List<WheelResponse> wheelResponse = wheelService.getWheelsByRoom(slug);
        return ResponseEntity.ok(ApiResponse.success(wheelResponse));
    }

    @PostMapping("/{wheelId}/spin")
    public ResponseEntity<ApiResponse<WheelSpinResponse>> spinWheel(@PathVariable String slug,
                                                                    @RequestHeader("X-Session-Token") String sessionToken,
                                                                    @RequestBody @Valid SpinWheelRequest request,
                                                                    @PathVariable Long wheelId) {

        WheelSpinResponse wheelSpinResponse = wheelService.spinWheel(slug, wheelId, sessionToken, request);
        return ResponseEntity.ok(ApiResponse.success(wheelSpinResponse));
    }

    @GetMapping("/{wheelId}/spins")
    public ResponseEntity<ApiResponse<List<WheelSpinResponse>>> getSpinsByWheel(@PathVariable String slug,
                                                                                @PathVariable Long wheelId) {
        List<WheelSpinResponse> spins = wheelService.getSpinsByWheel(slug, wheelId);
        return ResponseEntity.ok(ApiResponse.success(spins));
    }
}
