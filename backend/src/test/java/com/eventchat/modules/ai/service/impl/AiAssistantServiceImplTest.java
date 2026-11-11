package com.eventchat.modules.ai.service.impl;

import com.eventchat.common.event.AiPromptRequested;
import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.ratelimit.service.RateLimitService;
import com.eventchat.modules.ai.client.GeminiClient;
import com.eventchat.modules.ai.config.AiProperties;
import com.eventchat.modules.ai.dto.AiDiscussionSummary;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.chat.service.ChatService.AiContextLine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.client.ResourceAccessException;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiAssistantServiceImplTest {
    private final AiProperties properties = new AiProperties();
    private final GeminiClient gemini = mock(GeminiClient.class);
    private final ChatService chat = mock(ChatService.class);
    private final RateLimitService limits = mock(RateLimitService.class);
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final AttachmentService attachments = mock(AttachmentService.class);
    private final AiAssistantServiceImpl service =
            new AiAssistantServiceImpl(properties, gemini, chat, limits, broker, new ObjectMapper(), attachments);
    private final AiPromptRequested request =
            new AiPromptRequested("room", 1L, "prompt", 5L, "thread-root", "guest", "hash", "Tóm tắt", true);

    @Test
    void summaryIncludesOnlySourcesThatBelongToItsContext() {
        properties.getGemini().setApiKey("test-key");
        when(chat.getAiContext(request, 20)).thenReturn(List.of(
                new AiContextLine("thread-root", "An", "Chốt họp lúc 10h.")));
        when(gemini.generateContent(anyString(), contains("Chốt họp lúc 10h."), eq(AiDiscussionSummary.SCHEMA)))
                .thenReturn("""
                        {"decided":[{"text":"Họp lúc 10h","sourceNumbers":[1,1,99]}],
                         "open":[{"text":"Nguồn bịa","sourceNumbers":[99]}],"next":[]}
                        """);

        service.processMention(request);

        var source = Map.of("id", "thread-root", "number", 1, "speaker", "An", "excerpt", "Chốt họp lúc 10h.");
        Map<String, Object> expected = Map.of("aiSummary", Map.of("decided", List.of(Map.of("text", "Họp lúc 10h",
                "sources", List.of(source))), "open", List.of(), "next", List.of(), "demo", false, "contextCount", 1));
        verify(chat).postAiReply(eq(request), contains("Họp lúc 10h"), eq(expected));
        verify(broker, times(2)).convertAndSend(eq("/topic/room.room.events"), any(Object.class));
    }

    @Test
    void rateLimitStopsRequestBeforeAccessingHistoryOrGemini() {
        doThrow(new RateLimitExceededException(30000)).when(limits).checkRoomAi(1L);

        service.processMention(request);

        verifyNoInteractions(chat, gemini);
        verify(broker).convertAndSend(eq("/topic/room.room.events"),
                argThat((Object event) -> event.toString().contains("AI_FAILED")));
    }

    @Test
    void imageSummaryUsesTheImageInsteadOfTheDiscussionSummarySchema() {
        AiPromptRequested imageRequest = new AiPromptRequested("room", 1L, "prompt", 5L, "thread-root",
                "guest", "hash", "tóm tắt nội dung ảnh này", true);
        properties.getGemini().setApiKey("test-key");
        when(chat.getAiContext(imageRequest, 20)).thenReturn(List.of());
        when(chat.getAiImages(imageRequest)).thenReturn(List.of(AttachmentResponse.builder().publicId("image").build()));
        when(attachments.downloadLinkedImage(1L, "hash", "image")).thenReturn(
                new AttachmentDownload("photo.png", "image/png", true, new ByteArrayInputStream(new byte[]{1, 2, 3})));
        when(gemini.generateContent(anyString(), contains("tóm tắt nội dung ảnh này"), isNull(),
                argThat(parts -> parts.size() == 1 && "AQID".equals(parts.getFirst().getData())))).thenReturn("Ảnh có một bảng lịch.");

        service.processMention(imageRequest);

        verify(chat).postAiReply(imageRequest, "Ảnh có một bảng lịch.", Map.of("aiImageCount", 1));
        verify(gemini, never()).generateContent(anyString(), anyString(), anyMap());
    }

    @Test
    void providerTimeoutReportsFailureWithoutPersistingAReply() {
        properties.getGemini().setApiKey("test-key");
        when(chat.getAiContext(request, 20)).thenReturn(List.of(new AiContextLine("root", "An", "Họp lúc 10h.")));
        when(gemini.generateContent(anyString(), anyString(), anyMap()))
                .thenThrow(new ResourceAccessException("simulated timeout"));

        service.processMention(request);

        verify(chat, never()).postAiReply(any(), anyString(), anyMap());
        verify(broker).convertAndSend(eq("/topic/room.room.events"),
                argThat((Object event) -> event.toString().contains("AI_FAILED")));
    }

    @Test
    void mockSummaryIsLabeledAndDoesNotCallProvider() {
        when(chat.getAiContext(request, 20)).thenReturn(List.of(new AiContextLine("root", "An", "Họp lúc 10h.")));

        service.processMention(request);

        verifyNoInteractions(gemini);
        verifyNoInteractions(attachments);
        verify(chat).postAiReply(eq(request), contains("Chế độ thử nghiệm"), anyMap());
    }
}
