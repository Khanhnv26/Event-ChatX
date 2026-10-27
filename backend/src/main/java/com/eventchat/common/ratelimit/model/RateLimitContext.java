package com.eventchat.common.ratelimit.model;

import com.eventchat.common.ratelimit.enums.RateLimitAction;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode
@AllArgsConstructor
public class RateLimitContext {
    private final RateLimitAction action;
    private final String clientIp;
    private final String roomSlug;
    private final String actorToken;
}
