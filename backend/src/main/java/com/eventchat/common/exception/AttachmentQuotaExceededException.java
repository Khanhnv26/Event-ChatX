package com.eventchat.common.exception;

public class AttachmentQuotaExceededException extends AttachmentConflictException {
    public AttachmentQuotaExceededException() {
        super("Phòng không còn đủ dung lượng cho tệp này");
    }
}
