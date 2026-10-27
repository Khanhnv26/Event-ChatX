package com.eventchat.modules.interaction.wheel.repository;

import com.eventchat.modules.interaction.wheel.entity.Wheel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
@Repository
public interface WheelRepository extends JpaRepository<Wheel, Long> {
    List<Wheel> findAllByRoomIdOrderByCreatedAtDesc(Long roomId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wheel w where w.id = :id")
    Optional<Wheel> findByIdForUpdate(@Param("id") Long id);
}
