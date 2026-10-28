package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.enums.AttachmentState;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    long countByRoom_IdAndUploaderSessionIdAndState(Long roomId, Long uploaderSessionId, AttachmentState state);

    Optional<Attachment> findByRoom_IdAndPublicId(Long roomId, String publicId);

    Optional<Attachment> findByRoom_IdAndUploaderSessionIdAndClientUploadId(Long roomId, Long uploaderSessionId, String clientUploadId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Attachment a WHERE a.room.id = :roomId AND a.publicId = :publicId")
    Optional<Attachment> findForUpdate(@Param("roomId") Long roomId,
                                       @Param("publicId") String publicId);
}
