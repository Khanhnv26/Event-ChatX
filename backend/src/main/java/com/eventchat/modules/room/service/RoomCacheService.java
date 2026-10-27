package com.eventchat.modules.room.service;

import com.eventchat.modules.room.cache.RoomSnapshot;

public interface RoomCacheService {
    RoomSnapshot getBySlug(String slug);
    void evict(String slug);
}
