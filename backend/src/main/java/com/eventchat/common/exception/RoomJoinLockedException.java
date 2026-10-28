package com.eventchat.common.exception;

public class RoomJoinLockedException extends RuntimeException {
    public RoomJoinLockedException() {
        super("Phòng đã bị khóa, không thể tham gia.");
    }
}
