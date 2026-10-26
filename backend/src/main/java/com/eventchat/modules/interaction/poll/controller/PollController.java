package com.eventchat.modules.interaction.poll.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.interaction.poll.dto.request.CastVoteRequest;
import com.eventchat.modules.interaction.poll.dto.request.CreatePollRequest;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.service.PollService;
import jakarta.validation.Valid;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms/{slug}/polls")
@RequiredArgsConstructor
public class PollController {

    private final PollService pollService;

    @PostMapping
    public ResponseEntity<ApiResponse<PollResponse>> createPoll(@PathVariable String slug,
                                                         @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                                         @Valid @RequestBody CreatePollRequest pollRequest) {
        PollResponse response = pollService.createPoll(slug, sessionToken, pollRequest);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PollResponse>>> getPollsByRoom(@PathVariable String slug) {
        List<PollResponse> response = pollService.getPollsByRoom(slug);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{pollId}/votes")
    public ResponseEntity<ApiResponse<PollResponse>> votePoll(@PathVariable String slug,
                                                              @PathVariable Long pollId,
                                                              @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
                                                              @RequestBody @Valid CastVoteRequest voteRequest) {
        PollResponse response = pollService.castVote(slug, pollId, sessionToken, voteRequest);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{pollId}/close")
    public ResponseEntity<ApiResponse<PollResponse>> closePoll(@PathVariable String slug,
                                                               @PathVariable Long pollId,
                                                               @RequestHeader(value = "X-Host-Token", required = false) String hostToken) {
        PollResponse response = pollService.closePoll(slug, pollId, hostToken);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

}
