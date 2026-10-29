CREATE TABLE room_attachment_quotas (
    room_id BIGINT NOT NULL PRIMARY KEY,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    stored_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_attachment_quota_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT ck_attachment_quota_nonnegative
        CHECK (reserved_bytes >= 0 AND stored_bytes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL,
    room_id BIGINT NOT NULL,
    uploader_session_id BIGINT NOT NULL,
    client_upload_id VARCHAR(64) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    declared_content_type VARCHAR(127) NOT NULL,
    detected_content_type VARCHAR(127) NULL,
    expected_size_bytes BIGINT NOT NULL,
    actual_size_bytes BIGINT NULL,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    charged_bytes BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(80) NULL,
    thumbnail_key VARCHAR(80) NULL,
    sha256 CHAR(64) NULL,
    width_px INT NULL,
    height_px INT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'RESERVED',
    bound_client_message_id VARCHAR(64) NULL,
    error_code VARCHAR(64) NULL,
    upload_expires_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_attachment_public_id UNIQUE (public_id),
    CONSTRAINT uk_attachment_client_upload
        UNIQUE (room_id, uploader_session_id, client_upload_id),
    CONSTRAINT fk_attachment_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT ck_attachment_sizes CHECK (
        expected_size_bytes > 0
        AND (actual_size_bytes IS NULL OR actual_size_bytes >= 0)
        AND reserved_bytes >= 0 AND charged_bytes >= 0
    ),
    INDEX idx_attachment_cleanup (state, expires_at),
    INDEX idx_attachment_upload_expiry (state, upload_expires_at),
    INDEX idx_attachment_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachment_delete_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    storage_key VARCHAR(80) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error_code VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_attachment_delete_key UNIQUE (storage_key),
    INDEX idx_attachment_delete_due (state, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
