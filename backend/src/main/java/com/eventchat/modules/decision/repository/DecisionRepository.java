package com.eventchat.modules.decision.repository;

import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.enums.DecisionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DecisionRepository extends JpaRepository<Decision, Long> {
    List<Decision> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);
    List<Decision> findAllByRoomIdAndStatusOrderByConfirmedAtAsc(Long roomId, DecisionStatus status);
}
