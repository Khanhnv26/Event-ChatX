package com.eventchat.modules.interaction.poll.repository;

import com.eventchat.modules.interaction.poll.entity.PollOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PollOptionRepository extends JpaRepository<PollOption, Long> {
    List<PollOption> findAllByPollIdOrderByDisplayOrderAsc(Long pollId);
}
