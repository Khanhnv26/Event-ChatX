package com.eventchat.modules.room.repository;


import com.eventchat.modules.room.entity.RoomSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomSessionRepository extends JpaRepository<RoomSession, Long> {
    Optional<RoomSession> findByRoomIdAndSessionTokenHash(Long roomId, String sessionTokenHash);
    List<RoomSession> findAllByRoomId(Long roomId);
}
