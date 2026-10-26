-- ========================================================
-- 1. BẢNG PHÒNG THẢO LUẬN (ROOMS)
-- ========================================================
CREATE TABLE rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    room_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    host_token_hash VARCHAR(64) NOT NULL,
    retention_policy VARCHAR(64) NOT NULL DEFAULT 'KEEP_UNTIL_EXPIRY',
    settings VARCHAR(1024) NOT NULL DEFAULT '{}',
    expires_at DATETIME(3) NOT NULL,
    closed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT uq_rooms_slug UNIQUE (slug),
    INDEX idx_rooms_status_expires (room_status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 2. BẢNG PHIÊN NGƯỜI THAM GIA (ROOM_SESSIONS)
-- ========================================================
CREATE TABLE room_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    guest_id VARCHAR(36) NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL,
    nickname VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'PARTICIPANT',
    joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_sessions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT uk_room_session_token UNIQUE (room_id, session_token_hash),
    CONSTRAINT uk_room_guest UNIQUE (room_id, guest_id),
    INDEX idx_room_sessions_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 3. BẢNG TIN NHẮN REALTIME (MESSAGES)
-- ========================================================
CREATE TABLE messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    author_session_id BIGINT NULL,
    client_message_id VARCHAR(64) NOT NULL,
    sequence BIGINT NOT NULL,
    message_type VARCHAR(32) NOT NULL DEFAULT 'TEXT',
    body VARCHAR(2048) NOT NULL,
    reply_to_id BIGINT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_author FOREIGN KEY (author_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    CONSTRAINT fk_messages_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
    
    CONSTRAINT uk_message_id UNIQUE (room_id, client_message_id),
    CONSTRAINT uk_room_message UNIQUE (room_id, sequence),
    INDEX idx_messages_sequence (room_id, sequence ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 4. BẢNG BÌNH CHỌN (POLLS & POLL_OPTIONS & POLL_VOTES)
-- ========================================================
CREATE TABLE polls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    creator_session_id BIGINT NULL,
    question TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    rules VARCHAR(1024) NOT NULL DEFAULT '{}',
    closed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_polls_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_polls_creator FOREIGN KEY (creator_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    INDEX idx_polls_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE poll_options (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poll_id BIGINT NOT NULL,
    label VARCHAR(255) NOT NULL,
    vote_count INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_options_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    INDEX idx_poll_options_poll (poll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE poll_votes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poll_id BIGINT NOT NULL,
    option_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_votes_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_option FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_poll_session_option UNIQUE (poll_id, session_id, option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 5. BẢNG VÒNG QUAY MAY MẮN (WHEELS & WHEEL_SPINS)
-- ========================================================
CREATE TABLE wheels (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    title VARCHAR(255) NULL,
    entries VARCHAR(2048) NOT NULL DEFAULT '[]',
    rules VARCHAR(1024) NOT NULL DEFAULT '{}',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_wheels_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_wheels_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wheel_spins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wheel_id BIGINT NOT NULL,
    room_id BIGINT NOT NULL,
    actor_session_id BIGINT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    entries_snapshot VARCHAR(2048) NOT NULL,
    result_entry VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_spins_wheel FOREIGN KEY (wheel_id) REFERENCES wheels(id) ON DELETE CASCADE,
    CONSTRAINT fk_spins_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_spins_actor FOREIGN KEY (actor_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    CONSTRAINT uq_wheel_spin_idempotency UNIQUE (idempotency_key),
    INDEX idx_wheel_spins_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 6. BẢNG THẺ QUYẾT ĐỊNH (DECISIONS & DECISION_CONFIRMATIONS)
-- ========================================================
CREATE TABLE decisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    created_by BIGINT NULL,
    text TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    evidence_refs VARCHAR(1024) NULL,
    confirmed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_decisions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_decisions_creator FOREIGN KEY (created_by) REFERENCES room_sessions(id) ON DELETE SET NULL,
    INDEX idx_decisions_room_status (room_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE decision_confirmations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    decision_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    choice VARCHAR(32) NOT NULL DEFAULT 'APPROVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_confirm_decision FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_confirm_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_decision_session UNIQUE (decision_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
