package com.eventchat.common.event;

public record RoomMembershipChangedEvent(String slug, String guestId, String type) {}
