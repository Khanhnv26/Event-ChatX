package com.eventchat.common.ratelimit.model;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor
public class RateLimitBucket {
    private final String key;
    private final TokenBucketPolicy policy;
}
