CREATE TABLE message_reactions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    message_id VARCHAR(64) NOT NULL,
    session_id BIGINT NOT NULL,
    emoji VARCHAR(16) NOT NULL,
    CONSTRAINT uq_message_reactions UNIQUE (room_id, message_id, session_id, emoji),
    CONSTRAINT fk_message_reactions_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_reactions_session FOREIGN KEY (session_id) REFERENCES room_sessions(id) ON DELETE CASCADE
);

CREATE TABLE room_message_pins (
    room_id BIGINT NOT NULL PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL,
    CONSTRAINT fk_room_message_pins_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

ALTER TABLE poll_votes ADD COLUMN rank_position INT NULL;
ALTER TABLE poll_options ADD COLUMN ranking_score INT NOT NULL DEFAULT 0;
