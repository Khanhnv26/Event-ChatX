package com.eventchat.modules.chat.service;

import java.time.Instant;

public interface SequenceGenerator {
    long next(Long roomId, Instant roomExpiresAt);
    void resync(Long roomId, Instant roomExpiresAt);
}
