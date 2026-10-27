package com.eventchat.common.ratelimit.config;

import com.eventchat.common.ratelimit.interceptor.RateLimitInterceptor;
import com.eventchat.common.ratelimit.service.RateLimitService;
import com.eventchat.common.ratelimit.service.impl.RateLimitServiceImpl;
import com.eventchat.common.security.ClientIpResolver;
import com.eventchat.infrastructure.redis.RedisTokenBucket;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class RateLimitWiringTest {

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties
    @ComponentScan(basePackages = "com.eventchat.common.ratelimit", excludeFilters =
            @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = Configuration.class))
    @Import({RateLimitWebConfig.class, ClientIpResolver.class, RedisTokenBucket.class})
    static class Config {}

    @Test
    void springWiresTheRefactoredPackagesWithoutDuplicateBeans() {
        new ApplicationContextRunner()
                .withUserConfiguration(Config.class)
                .withBean(StringRedisTemplate.class, () -> mock(StringRedisTemplate.class))
                .run(context -> {
                    assertNull(context.getStartupFailure());
                    assertEquals(1, context.getBeansOfType(RateLimitProperties.class).size());
                    assertEquals(1, context.getBeansOfType(RateLimitService.class).size());
                    assertInstanceOf(RateLimitServiceImpl.class, context.getBean(RateLimitService.class));
                    assertNotNull(context.getBean(RateLimitInterceptor.class));
                    assertNotNull(context.getBean(RateLimitWebConfig.class));
                });
    }
}
