package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.AttachmentDeleteTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.time.Instant;
import com.eventchat.modules.attachment.enums.AttachmentDeleteState;

@Repository
public interface AttachmentDeleteTaskRepository extends JpaRepository<AttachmentDeleteTask, Long> {
    Optional<AttachmentDeleteTask> findByStorageKey(String storageKey);
    List<AttachmentDeleteTask> findTop25ByStateAndNextAttemptAtLessThanEqualOrderByIdAsc(AttachmentDeleteState state, Instant now);
}
