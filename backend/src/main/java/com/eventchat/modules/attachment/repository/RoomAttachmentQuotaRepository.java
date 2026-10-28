package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.RoomAttachmentQuota;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoomAttachmentQuotaRepository extends JpaRepository<RoomAttachmentQuota, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RoomAttachmentQuota r WHERE r.roomId = :roomId")
    Optional<RoomAttachmentQuota> findForUpdate(@Param("roomId") Long roomId);
}
