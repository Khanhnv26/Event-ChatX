package com.eventchat.common.ratelimit.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum RateLimitAction {
    CREATE_ROOM("create-room", null),
    JOIN_ROOM("join-room", null),
    CHAT("chat", "X-Session-Token"),
    TOOL_CREATE("tool-create", "X-Session-Token"),
    VOTE("vote", "X-Session-Token"),
    SPIN("spin", "X-Session-Token"),
    HOST_WRITE("host-write", "X-Host-Token"),
    UPLOAD_INTENT("upload-intent", "X-Session-Token"),
    UPLOAD_CONTENT("upload-content", "X-Session-Token");

    private final String key;
    private final String tokenHeader;
}
