package com.eventchat.common.exception;

public class RateLimitExceededException extends RuntimeException {
    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterMillis) {
        super("Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
        retryAfterSeconds = Math.max(1, (retryAfterMillis + 999) / 1000);
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
