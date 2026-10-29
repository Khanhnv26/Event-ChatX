package com.eventchat.modules.interaction.poll.service;

import com.eventchat.modules.interaction.poll.dto.request.CastVoteRequest;
import com.eventchat.modules.interaction.poll.dto.request.CreatePollRequest;
import com.eventchat.modules.interaction.poll.dto.request.UpdateVotesRequest;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;

import java.util.List;

public interface PollService {
    PollResponse updateVotes(String slug, Long pollId, String rawSessionToken,
            UpdateVotesRequest request);
    PollResponse createPoll(String slug, String rawSessionToken, CreatePollRequest pollRequest);
    PollResponse castVote(String slug, Long pollId, String rawSessionToken, CastVoteRequest voteRequest);
    PollResponse closePoll(String slug, Long pollId, String rawHostToken);
    List<PollResponse> getPollsByRoom(String slug);
    List<PollResponse> getPollsByRoom(String slug, String rawSessionToken);

}
