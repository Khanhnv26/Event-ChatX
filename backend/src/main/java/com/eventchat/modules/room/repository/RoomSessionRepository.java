package com.eventchat.modules.room.repository;


import com.eventchat.modules.room.entity.RoomSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomSessionRepository extends JpaRepository<RoomSession, Long> {
    boolean existsByIdAndRoomIdAndRevokedAtIsNull(Long id, Long roomId);
    Optional<RoomSession> findByRoomIdAndSessionTokenHash(Long roomId, String sessionTokenHash);
    List<RoomSession> findAllByRoomId(Long roomId);
    long countByRoomId(Long roomId);
    Optional<RoomSession> findByRoomIdAndGuestId(Long roomId, String guestId);
    Optional<RoomSession> findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(Long roomId, String sessionTokenHash);
    List<RoomSession> findAllByRoomIdAndRevokedAtIsNull(Long roomId);
    long countByRoomIdAndRevokedAtIsNull(Long roomId);
}
