package com.eventchat.modules.room.service;

import com.eventchat.modules.room.cache.SessionSnapshot;

public interface RoomAccessService {
    void requireReadAccess(String slug, String rawSessionToken);
    SessionSnapshot readSession(String slug, String rawSessionToken);
    SessionSnapshot lockWritableSession(String slug, String rawSessionToken);
    Long lockWritableRoomForHost(String slug, String rawHostToken);
}
