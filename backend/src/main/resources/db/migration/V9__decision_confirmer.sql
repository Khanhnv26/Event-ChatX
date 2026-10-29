ALTER TABLE decisions
    ADD COLUMN confirmed_by_guest_id VARCHAR(36) NULL,
    ADD COLUMN confirmed_by_nickname VARCHAR(64) NULL;
