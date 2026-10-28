package com.eventchat.common.ratelimit.service.impl;

import com.eventchat.common.ratelimit.config.RateLimitProperties;
import com.eventchat.common.ratelimit.enums.RateLimitAction;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.model.RateLimitContext;
import com.eventchat.common.ratelimit.model.TokenBucketPolicy;
import com.eventchat.common.ratelimit.service.RateLimitService;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.redis.RedisKeys;
import com.eventchat.infrastructure.redis.RedisTokenBucket;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RateLimitServiceImpl implements RateLimitService {

    private final RedisTokenBucket tokenBucket;
    private final RateLimitProperties properties;

    @Override
    public void check(RateLimitContext context) {
        String prefix = properties.getKeyPrefix();
        String ipHash = TokenUtil.sha256(context.getClientIp());
        List<RateLimitBucket> buckets = new ArrayList<>();

        if (context.getAction() == RateLimitAction.CREATE_ROOM) {
            buckets.add(new RateLimitBucket(
                    RedisKeys.rateLimitIp(prefix, "create-room", ipHash), properties.getCreateRoom()));
        } else {
            String roomHash = TokenUtil.sha256(context.getRoomSlug());
            if (context.getAction() == RateLimitAction.JOIN_ROOM) {
                buckets.add(new RateLimitBucket(
                        RedisKeys.rateLimitIp(prefix, "join-room", ipHash), properties.getJoinRoom()));
                buckets.add(new RateLimitBucket(
                        RedisKeys.rateLimitRoom(prefix, "join-room", roomHash), properties.getRoomJoin()));
            } else {
                addWriteBuckets(buckets, context, prefix, ipHash, roomHash);
            }
        }

        tokenBucket.consume(buckets);
    }

    private void addWriteBuckets(List<RateLimitBucket> buckets, RateLimitContext context,
                                 String prefix, String ipHash, String roomHash) {
        buckets.add(new RateLimitBucket(
                RedisKeys.rateLimitIp(prefix, "write", ipHash), properties.getIpWrite()));
        buckets.add(new RateLimitBucket(
                RedisKeys.rateLimitRoom(prefix, "write", roomHash), properties.getRoomWrite()));

        if (context.getActorToken() == null || context.getActorToken().isBlank()) {
            return;
        }

        String actorHash = TokenUtil.sha256(context.getActorToken());
        buckets.add(new RateLimitBucket(
                RedisKeys.rateLimitActor(prefix, context.getAction().getKey(), roomHash, actorHash),
                policyFor(context.getAction())));
    }

    private TokenBucketPolicy policyFor(RateLimitAction action) {
        return switch (action) {
            case CHAT -> properties.getChat();
            case TOOL_CREATE -> properties.getToolCreate();
            case UPLOAD_INTENT -> properties.getUploadIntent();
            case UPLOAD_CONTENT -> properties.getUploadContent();
            case VOTE -> properties.getVote();
            case SPIN -> properties.getSpin();
            case HOST_WRITE -> properties.getHostWrite();
            case CREATE_ROOM, JOIN_ROOM -> throw new IllegalArgumentException("Public action has no actor bucket");
        };
    }
}
