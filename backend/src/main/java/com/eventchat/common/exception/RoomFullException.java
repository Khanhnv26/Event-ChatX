package com.eventchat.common.exception;

public class RoomFullException extends RuntimeException {
    public RoomFullException() {
        super("Phòng đã đủ số lượng thành viên");
    }
}
