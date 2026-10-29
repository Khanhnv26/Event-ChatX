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
import java.util.List;
import java.time.Instant;
import org.springframework.data.domain.Pageable;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    long countByRoom_IdAndUploaderSessionIdAndState(Long roomId, Long uploaderSessionId, AttachmentState state);

    List<Attachment> findTop10ByStateOrderByIdAsc(AttachmentState state);

    @Query("select a from Attachment a where a.state in :states or a.expiresAt <= :now "
            + "or (a.state in :pending and a.uploadExpiresAt <= :now) order by a.id")
    List<Attachment> findCleanupCandidates(@Param("states") List<AttachmentState> states,
            @Param("pending") List<AttachmentState> pending, @Param("now") Instant now, Pageable pageable);

    Optional<Attachment> findByRoom_IdAndPublicId(Long roomId, String publicId);

    Optional<Attachment> findByRoom_IdAndUploaderSessionIdAndClientUploadId(Long roomId, Long uploaderSessionId, String clientUploadId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Attachment a WHERE a.room.id = :roomId AND a.publicId = :publicId")
    Optional<Attachment> findForUpdate(@Param("roomId") Long roomId,
                                       @Param("publicId") String publicId);
}
