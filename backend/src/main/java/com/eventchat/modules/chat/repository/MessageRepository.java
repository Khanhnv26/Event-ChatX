package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query(
        "SELECT m FROM Message m WHERE m.room.id = :roomId AND m.clientMessageId = :clientMessageId"
    )
    Optional<Message> findByRoomIdAndClientMessageId(@Param("roomId") Long roomId,
                                                     @Param("clientMessageId") String clientMessageId);

    @Query("SELECT COALESCE(MAX(m.sequence), 0) from Message m WHERE m.room.id = :roomId")
    Long findMaxSequenceByRoomId(@Param("roomId") Long roomId);

    List<Message> findAllByRoomIdOrderBySequenceAsc(Long roomId);
    List<Message> findAllByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(Long roomId, Long afterSequence);
}
