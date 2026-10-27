package com.eventchat.modules.decision.repository;

import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.enums.DecisionStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DecisionRepository extends JpaRepository<Decision, Long> {
    List<Decision> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);
    List<Decision> findAllByRoomIdAndStatusOrderByConfirmedAtAsc(Long roomId, DecisionStatus status);



    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT d FROM Decision d
            WHERE d.id = :decisionId AND d.room.id = :roomId
            """)
    Optional<Decision> findByIdAndRoomIdForUpdate (
            @Param("decisionId") Long decisionId,
            @Param("roomId") Long roomId

    );
}
