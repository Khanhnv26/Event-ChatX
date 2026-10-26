package com.eventchat.modules.room.repository;

import com.eventchat.modules.room.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoomRepository  extends JpaRepository<Room, Long> {
    Optional<Room> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
