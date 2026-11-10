package com.eventchat.modules.ai.config;

import lombok.Getter;
import lombok.Setter;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

@Configuration
@ConfigurationProperties(prefix = "app.ai")
@Validated
@Getter
@Setter
public class AiProperties {

    private boolean enabled = true;
    private GeminiConfig gemini = new GeminiConfig();
    @Min(2)
    @Max(40)
    private int maxContextMessages = 20;

    @Getter
    @Setter
    public static class GeminiConfig {
        private String apiKey = "";
        private String model = "gemini-3.5-flash-lite";
        private String baseUrl = "https://generativelanguage.googleapis.com";
        private double temperature = 0.7;
    }
}
