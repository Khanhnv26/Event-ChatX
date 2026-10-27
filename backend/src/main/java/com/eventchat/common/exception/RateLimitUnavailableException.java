package com.eventchat.common.exception;

public class RateLimitUnavailableException extends RuntimeException {
    public RateLimitUnavailableException() {
        super("Hệ thống kiểm soát tốc độ tạm thời không khả dụng. Vui lòng thử lại.");
    }
}
