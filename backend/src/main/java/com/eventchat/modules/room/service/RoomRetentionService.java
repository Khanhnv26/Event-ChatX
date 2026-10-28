package com.eventchat.modules.room.service;

public interface RoomRetentionService {
    boolean purge(String slug);
}
