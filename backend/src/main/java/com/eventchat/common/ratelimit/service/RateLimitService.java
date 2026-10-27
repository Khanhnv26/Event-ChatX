package com.eventchat.common.ratelimit.service;

import com.eventchat.common.ratelimit.model.RateLimitContext;

public interface RateLimitService {

    void check(RateLimitContext context);
}
