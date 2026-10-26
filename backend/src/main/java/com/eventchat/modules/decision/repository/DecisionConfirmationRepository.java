package com.eventchat.modules.decision.repository;

import com.eventchat.modules.decision.entity.DecisionConfirmation;
import com.eventchat.modules.decision.enums.ConfirmationChoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DecisionConfirmationRepository extends JpaRepository<DecisionConfirmation, Long> {
    Optional<DecisionConfirmation> findByDecisionIdAndSessionId(Long decisionId, Long sessionId);
    long countByDecisionIdAndChoice(Long decisionId, ConfirmationChoice choice);
    List<DecisionConfirmation> findAllByDecisionId(Long decisionId);
}
