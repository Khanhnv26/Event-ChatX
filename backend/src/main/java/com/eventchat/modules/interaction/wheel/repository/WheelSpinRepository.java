package com.eventchat.modules.interaction.wheel.repository;

import com.eventchat.modules.interaction.wheel.entity.WheelSpin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WheelSpinRepository extends JpaRepository<WheelSpin, Long> {
    Optional<WheelSpin> findByWheelIdAndIdempotencyKey(Long wheelId, String idempotencyKey);
    List<WheelSpin> findAllByWheelIdOrderByCreatedAtDesc(Long wheelId);
}
