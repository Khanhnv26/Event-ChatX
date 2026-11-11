package com.eventchat.modules.ai.client;

import com.eventchat.modules.ai.config.AiProperties;
import com.eventchat.modules.ai.dto.GeminiRequest;
import com.eventchat.modules.ai.dto.GeminiResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;

@Component
public class GeminiClient {
    private final AiProperties properties;
    private final RestClient restClient;

    public GeminiClient(AiProperties properties, @Qualifier("geminiRestClient") RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
    }

    public String generateContent(String systemInstruction, String input, Map<String, Object> schema) {
        return generateContent(systemInstruction, input, schema, List.of());
    }

    public String generateContent(String systemInstruction, String input, Map<String, Object> schema,
                                  List<GeminiRequest.InlineData> images) {
        GeminiRequest.GenerationConfig.GenerationConfigBuilder generation = GeminiRequest.GenerationConfig.builder()
                .temperature(schema == null ? properties.getGemini().getTemperature() : 0.2)
                .maxOutputTokens(schema == null ? 1200 : 2400);
        if (schema != null) {
            generation.responseMimeType(MediaType.APPLICATION_JSON_VALUE).responseJsonSchema(schema);
        }
        List<GeminiRequest.Part> parts = new ArrayList<>();
        parts.add(GeminiRequest.Part.builder().text(input).build());
        for (GeminiRequest.InlineData image : images) {
            parts.add(GeminiRequest.Part.builder().inlineData(image).build());
        }
        GeminiRequest request = GeminiRequest.builder()
                .contents(List.of(GeminiRequest.Content.builder().role("user")
                        .parts(parts).build()))
                .systemInstruction(GeminiRequest.Content.builder()
                        .parts(List.of(GeminiRequest.Part.builder().text(systemInstruction).build())).build())
                .generationConfig(generation.build())
                .build();

        AiProperties.GeminiConfig config = properties.getGemini();
        GeminiResponse response = restClient.post()
                .uri("/v1beta/models/{model}:generateContent", config.getModel())
                .header("x-goog-api-key", config.getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve().body(GeminiResponse.class);
        String answer = response == null ? null : response.getText();
        if (answer == null || answer.isBlank()) {
            throw new IllegalStateException("Gemini returned no visible text");
        }
        return answer;
    }
}
