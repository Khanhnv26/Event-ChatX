package com.eventchat.common.ratelimit.config;

import com.eventchat.common.ratelimit.model.TokenBucketPolicy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    @NotBlank
    private String keyPrefix = "eventchat:ratelimit:";

    @Valid
    @NotNull
    private TokenBucketPolicy createRoom = new TokenBucketPolicy(3, 1.0 / 60);

    @Valid
    @NotNull
    private TokenBucketPolicy joinRoom = new TokenBucketPolicy(20, 1);

    @Valid
    @NotNull
    private TokenBucketPolicy roomJoin = new TokenBucketPolicy(50, 5);

    @Valid
    @NotNull
    private TokenBucketPolicy ipWrite = new TokenBucketPolicy(30, 5);

    @Valid
    @NotNull
    private TokenBucketPolicy roomWrite = new TokenBucketPolicy(100, 50);

    @Valid
    @NotNull
    private TokenBucketPolicy chat = new TokenBucketPolicy(5, 0.5);

    @Valid
    @NotNull
    private TokenBucketPolicy toolCreate = new TokenBucketPolicy(3, 0.1);

    @Valid
    @NotNull
    private TokenBucketPolicy vote = new TokenBucketPolicy(10, 2);

    @Valid
    @NotNull
    private TokenBucketPolicy spin = new TokenBucketPolicy(3, 0.5);

    @Valid
    @NotNull
    private TokenBucketPolicy hostWrite = new TokenBucketPolicy(5, 1);

    @NotNull
    private Set<String> trustedProxies = new HashSet<>();
}
