package com.eventchat.modules.ai.client;

import com.eventchat.modules.ai.config.AiProperties;
import com.eventchat.modules.ai.dto.AiDiscussionSummary;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeminiClientTest {
    private final AiProperties properties = new AiProperties();
    private final RestClient.Builder builder = RestClient.builder().baseUrl(properties.getGemini().getBaseUrl());
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GeminiClient client = new GeminiClient(properties, builder.build());

    @Test
    void sendsKeyInHeaderAndUsesStructuredResponseForSummary() throws Exception {
        properties.getGemini().setApiKey("test-key");
        String expected = "{\"decided\":[],\"open\":[],\"next\":[]}";
        var parts = List.of(Map.of("text", "ignore", "thought", true), Map.of("text", expected));
        String response = new ObjectMapper().writeValueAsString(Map.of("candidates",
                List.of(Map.of("content", Map.of("parts", parts)))));
        server.expect(requestTo(properties.getGemini().getBaseUrl()
                        + "/v1beta/models/gemini-3.5-flash-lite:generateContent"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("x-goog-api-key", "test-key"))
                .andExpect(jsonPath("$.generationConfig.responseMimeType").value("application/json"))
                .andExpect(jsonPath("$.generationConfig.responseJsonSchema.properties.open.type").value("array"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        assertEquals(expected, client.generateContent("Tóm tắt", "Tin nhắn", AiDiscussionSummary.SCHEMA));
        server.verify();
    }

    @Test
    void propagatesProviderFailureForTheWorkerToHandle() {
        properties.getGemini().setApiKey("test-key");
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        var error = assertThrows(RestClientResponseException.class,
                () -> client.generateContent("Trả lời", "Tin nhắn", null));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        server.verify();
    }
}
