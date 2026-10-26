package com.eventchat.modules.interaction.poll.repository;

import com.eventchat.modules.interaction.poll.entity.Poll;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PollRepository extends JpaRepository<Poll, Long> {
    List<Poll> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);
}
