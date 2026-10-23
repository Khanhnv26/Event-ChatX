-- ========================================================
-- 1. BẢNG PHÒNG THẢO LUẬN (ROOMS)
-- ========================================================
CREATE TABLE rooms (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_code VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    host_token_hash VARCHAR(64) NOT NULL,
    settings JSON NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    closed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT uq_rooms_code UNIQUE (room_code),
    INDEX idx_rooms_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 2. BẢNG PHIÊN NGƯỜI THAM GIA (ROOM_SESSIONS)
-- ========================================================
CREATE TABLE room_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id VARCHAR(36) NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL,
    nickname VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'PARTICIPANT',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_sessions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT uq_room_session_token UNIQUE (room_id, session_token_hash),
    INDEX idx_room_sessions_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 3. BẢNG TIN NHẮN REALTIME (MESSAGES)
-- ========================================================
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id VARCHAR(36) NOT NULL,
    author_session_id VARCHAR(36) NULL,
    client_message_id VARCHAR(64) NOT NULL,
    sequence_num BIGINT NOT NULL,
    message_type VARCHAR(32) NOT NULL DEFAULT 'TEXT',
    body TEXT NOT NULL,
    reply_to_id VARCHAR(36) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_author FOREIGN KEY (author_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    CONSTRAINT fk_messages_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
    
    CONSTRAINT uq_room_client_msg UNIQUE (room_id, client_message_id),
    CONSTRAINT uq_room_sequence UNIQUE (room_id, sequence_num),
    INDEX idx_messages_sequence (room_id, sequence_num ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 4. BẢNG BÌNH CHỌN (POLLS & OPTIONS & VOTES)
-- ========================================================
CREATE TABLE polls (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id VARCHAR(36) NOT NULL,
    creator_session_id VARCHAR(36) NULL,
    question TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    allow_multiple TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    closed_at DATETIME(3) NULL,
    
    CONSTRAINT fk_polls_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_polls_creator FOREIGN KEY (creator_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    INDEX idx_polls_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE poll_options (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    poll_id VARCHAR(36) NOT NULL,
    option_text VARCHAR(255) NOT NULL,
    vote_count INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    
    CONSTRAINT fk_options_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    INDEX idx_poll_options_poll (poll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE poll_votes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    poll_id VARCHAR(36) NOT NULL,
    option_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_votes_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_option FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_poll_session_option UNIQUE (poll_id, session_id, option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 5. BẢNG VÒNG QUAY MAY MẮN (WHEEL_SPINS)
-- ========================================================
CREATE TABLE wheel_spins (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id VARCHAR(36) NOT NULL,
    actor_session_id VARCHAR(36) NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    entries_snapshot JSON NOT NULL,
    winner_entry VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_wheel_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_wheel_actor FOREIGN KEY (actor_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    CONSTRAINT uq_wheel_idempotency UNIQUE (idempotency_key),
    INDEX idx_wheel_spins_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- 6. BẢNG THẺ QUYẾT ĐỊNH (DECISIONS & CONFIRMATIONS)
-- ========================================================
CREATE TABLE decisions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id VARCHAR(36) NOT NULL,
    creator_session_id VARCHAR(36) NULL,
    title TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    evidence_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    evidence_ref_id VARCHAR(36) NULL,
    confirmed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_decisions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_decisions_creator FOREIGN KEY (creator_session_id) REFERENCES room_sessions(id) ON DELETE SET NULL,
    INDEX idx_decisions_room_status (room_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE decision_confirmations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    decision_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    agreed TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    CONSTRAINT fk_confirm_decision FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_confirm_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_decision_session UNIQUE (decision_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
