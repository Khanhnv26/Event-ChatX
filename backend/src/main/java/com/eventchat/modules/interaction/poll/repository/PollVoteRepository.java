package com.eventchat.modules.interaction.poll.repository;

import com.eventchat.modules.interaction.poll.entity.PollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PollVoteRepository extends JpaRepository<PollVote, Long> {
    boolean existsByPollIdAndSessionId(Long pollId, Long sessionId);
    boolean existsByPollIdAndSessionIdAndOptionId(Long pollId, Long sessionId, Long optionId);
    List<PollVote> findAllByPollIdAndSessionId(Long pollId, Long sessionId);
}
