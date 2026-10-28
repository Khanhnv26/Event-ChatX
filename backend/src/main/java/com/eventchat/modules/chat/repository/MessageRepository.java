package com.eventchat.modules.chat.repository;

import com.eventchat.modules.chat.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {
    long deleteByRoomId(Long roomId);

    Optional<Message> findByRoomIdAndClientMessageId(Long roomId, String clientMessageId);

    Optional<Message> findTopByRoomIdOrderBySequenceDesc(Long roomId);

    List<Message> findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(Long roomId, Long afterSequence, Pageable pageable);

    List<Message> findByRoomIdOrderBySequenceDesc(Long roomId, Pageable pageable);
}
