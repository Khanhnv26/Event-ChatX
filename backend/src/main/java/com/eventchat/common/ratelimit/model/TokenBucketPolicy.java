package com.eventchat.common.ratelimit.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode
public class TokenBucketPolicy {

    private long capacity;
    private double refillPerSecond;

    public TokenBucketPolicy(long capacity, double refillPerSecond) {
        validate(capacity, refillPerSecond);
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
    }

    public void setCapacity(long capacity) {
        validate(capacity, this.refillPerSecond);
        this.capacity = capacity;
    }

    public void setRefillPerSecond(double refillPerSecond) {
        validate(this.capacity, refillPerSecond);
        this.refillPerSecond = refillPerSecond;
    }

    private static void validate(long capacity, double refillPerSecond) {
        if (capacity < 1 || capacity > 1_000_000
                || !Double.isFinite(refillPerSecond)
                || refillPerSecond < 0.000001 || refillPerSecond > 1_000_000) {
            throw new IllegalArgumentException("Invalid token bucket capacity or refill rate");
        }
    }
}
