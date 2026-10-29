package com.eventchat.common.exception;

public class UnsupportedAttachmentTypeException extends RuntimeException {
    public UnsupportedAttachmentTypeException() {
        super("Loại tệp không được hỗ trợ");
    }
}
