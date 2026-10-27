package com.eventchat.common.ratelimit.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitPropertiesTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner().withUserConfiguration(Config.class);

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(RateLimitProperties.class)
    static class Config {}

    @Test
    void limitsCanBeConfiguredWithoutChangingCode() {
        context.withPropertyValues("app.rate-limit.chat.capacity=7", "app.rate-limit.chat.refill-per-second=0.25",
                "app.rate-limit.trusted-proxies=127.0.0.1,192.0.2.10").run(ctx -> {
            assertNull(ctx.getStartupFailure());
            var properties = ctx.getBean(RateLimitProperties.class);
            assertEquals(7, properties.getChat().getCapacity());
            assertEquals(0.25, properties.getChat().getRefillPerSecond());
            assertTrue(properties.getTrustedProxies().contains("192.0.2.10"));
            assertEquals(3, properties.getCreateRoom().getCapacity());
        });
    }

    @Test
    void invalidConfigurationPreventsStartup() {
        context.withPropertyValues("app.rate-limit.chat.refill-per-second=0")
                .run(ctx -> assertNotNull(ctx.getStartupFailure()));
    }
}
