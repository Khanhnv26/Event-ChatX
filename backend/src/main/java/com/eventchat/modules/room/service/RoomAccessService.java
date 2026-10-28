package com.eventchat.modules.room.service;

public interface RoomAccessService {
    void requireReadAccess(String slug, String rawSessionToken);
}
