package com.eventchat.modules.attachment.repository;

import com.eventchat.modules.attachment.entity.AttachmentDeleteTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AttachmentDeleteTaskRepository extends JpaRepository<AttachmentDeleteTask, Long> {
    Optional<AttachmentDeleteTask> findByStorageKey(String storageKey);
}
