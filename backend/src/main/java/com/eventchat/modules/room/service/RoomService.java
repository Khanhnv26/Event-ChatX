package com.eventchat.modules.room.service;

import com.eventchat.modules.room.dto.request.CreateRoomRequest;
import com.eventchat.modules.room.dto.request.JoinRoomRequest;
import com.eventchat.modules.room.dto.response.RoomAuthResponse;
import com.eventchat.modules.room.dto.response.RoomDetailResponse;

public interface RoomService {
    RoomAuthResponse createRoom(CreateRoomRequest request);
    RoomAuthResponse joinRoom(String slug, JoinRoomRequest request);
    void closeRoom(String slug, String rawHostToken);
    RoomDetailResponse getRoomDetails(String slug);
    RoomAuthResponse reconnect(String slug, String rawSessionToken);
}
