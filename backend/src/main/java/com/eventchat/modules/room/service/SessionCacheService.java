package com.eventchat.modules.room.service;

import com.eventchat.modules.room.cache.SessionSnapshot;

public interface SessionCacheService {
    SessionSnapshot getByToken(String slug, Long roomId, String tokenHash);
    void evict(String slug, String tokenHash);
}
