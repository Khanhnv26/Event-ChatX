package com.eventchat.modules.interaction.wheel.repository;

import com.eventchat.modules.interaction.wheel.entity.Wheel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
@Repository
public interface WheelRepository extends JpaRepository<Wheel, Long> {
    List<Wheel> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);
}
