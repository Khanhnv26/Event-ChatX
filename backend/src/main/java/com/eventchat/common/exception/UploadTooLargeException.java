package com.eventchat.common.exception;

public class UploadTooLargeException extends RuntimeException {
    public UploadTooLargeException(Long maxBytes) {
        super("Dung lượng tệp tải lên vượt quá giới hạn cho phép." + " Giới hạn: " + maxBytes + " bytes.");
    }
}
