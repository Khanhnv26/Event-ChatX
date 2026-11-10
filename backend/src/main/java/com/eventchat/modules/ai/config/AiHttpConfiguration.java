package com.eventchat.modules.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration(proxyBeanMethods = false)
class AiHttpConfiguration {
    @Bean
    RestClient geminiRestClient(AiProperties properties) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(18));
        return RestClient.builder().baseUrl(properties.getGemini().getBaseUrl()).requestFactory(factory).build();
    }
}
