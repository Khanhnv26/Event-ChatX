package com.eventchat.common.exception;

public class AttachmentStorageException extends RuntimeException {
    public AttachmentStorageException(Throwable cause) {
        super("Không thể lưu tệp lúc này. Vui lòng thử lại sau.", cause);
    }
}
