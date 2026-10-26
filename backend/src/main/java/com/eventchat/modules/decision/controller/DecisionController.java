package com.eventchat.modules.decision.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.decision.dto.request.ConfirmDecisionRequest;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.dto.request.UpdateDecisionStatusRequest;
import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.decision.service.DecisionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/decisions")
public class DecisionController {

    private final DecisionService decisionService;

    @PostMapping
    public ResponseEntity<ApiResponse<DecisionResponse>> createDecision(
            @PathVariable String slug,
            @RequestHeader("X-Session-Token") String sessionToken,
            @Valid @RequestBody CreateDecisionRequest request) {
        DecisionResponse response = decisionService.createDecision(slug, sessionToken, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DecisionResponse>>> getDecisions(@PathVariable String slug) {
        List<DecisionResponse> response = decisionService.getDecisionsByRoom(slug);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{decisionId}/confirm")
    public ResponseEntity<ApiResponse<DecisionResponse>> confirmDecision(
            @PathVariable String slug,
            @PathVariable Long decisionId,
            @RequestHeader("X-Session-Token") String sessionToken,
            @Valid @RequestBody ConfirmDecisionRequest request) {
        DecisionResponse response = decisionService.confirmDecision(slug, decisionId, sessionToken, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{decisionId}/status")
    public ResponseEntity<ApiResponse<DecisionResponse>> updateDecisionStatus(
            @PathVariable String slug,
            @PathVariable Long decisionId,
            @RequestHeader("X-Host-Token") String hostToken,
            @Valid @RequestBody UpdateDecisionStatusRequest request) {
        DecisionResponse response = decisionService.updateDecisionStatus(slug, decisionId, hostToken, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
