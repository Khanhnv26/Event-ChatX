package com.eventchat.modules.attachment.controller;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.common.exception.RateLimitExceededException;
import com.eventchat.common.exception.RateLimitUnavailableException;
import com.eventchat.common.ratelimit.config.RateLimitProperties;
import com.eventchat.common.ratelimit.interceptor.RateLimitInterceptor;
import com.eventchat.common.ratelimit.model.RateLimitBucket;
import com.eventchat.common.ratelimit.service.impl.RateLimitServiceImpl;
import com.eventchat.common.security.ClientIpResolver;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.redis.RedisTokenBucket;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.dto.response.UploadContentResponse;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.attachment.service.AttachmentContentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AttachmentControllerTest {
    private static final String BODY = """
            {"clientUploadId":"cd310ef1-2b95-4df0-9824-af65c77ba1a8",
             "filename":"demo.png","declaredContentType":"image/png","sizeBytes":102400}
            """;

    private final AttachmentService service = mock(AttachmentService.class);
    private final RedisTokenBucket limiter = mock(RedisTokenBucket.class);
    private final RateLimitProperties properties = new RateLimitProperties();
    private final AttachmentContentService contentService = mock(AttachmentContentService.class);
    private final com.eventchat.modules.attachment.service.impl.AttachmentAccessService accessService =
            mock(com.eventchat.modules.attachment.service.impl.AttachmentAccessService.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new AttachmentController(service, contentService,
            accessService))
            .setMessageConverters(new MappingJackson2HttpMessageConverter(
                    Jackson2ObjectMapperBuilder.json()
                            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build()),
                    new org.springframework.http.converter.ResourceHttpMessageConverter())
            .addInterceptors(new RateLimitInterceptor(new RateLimitServiceImpl(limiter, properties),
                    new ClientIpResolver(properties)))
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test
    void returnsIntentAndUsesSeparateUploadBucketAlongsideIpAndRoomBuckets() throws Exception {
        Instant deadline = Instant.parse("2026-10-29T15:00:00Z");
        when(service.createIntent(eq("room"), eq("test-session"), any()))
                .thenReturn(new UploadIntentResponse("public-id", AttachmentState.RESERVED, 102400, deadline));

        mvc.perform(post("/api/v1/rooms/room/attachments").header("X-Session-Token", "test-session")
                        .contentType("application/json").content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.publicId").value("public-id"))
                .andExpect(jsonPath("$.data.state").value("RESERVED"))
                .andExpect(jsonPath("$.data.sizeBytes").value(102400))
                .andExpect(jsonPath("$.data.uploadExpiresAt").value(deadline.toString()));

        ArgumentCaptor<CreateUploadIntentRequest> request = ArgumentCaptor.forClass(CreateUploadIntentRequest.class);
        verify(service).createIntent(eq("room"), eq("test-session"), request.capture());
        assertEquals("demo.png", request.getValue().getFilename());
        assertEquals(102400L, request.getValue().getSizeBytes());
        verify(limiter).consume(argThat((List<RateLimitBucket> buckets) -> {
            assertEquals(3, buckets.size());
            assertSame(properties.getIpWrite(), buckets.get(0).getPolicy());
            assertSame(properties.getRoomWrite(), buckets.get(1).getPolicy());
            assertSame(properties.getUploadIntent(), buckets.get(2).getPolicy());
            assertEquals(4, buckets.get(2).getPolicy().getCapacity());
            assertEquals(0.1, buckets.get(2).getPolicy().getRefillPerSecond());
            assertTrue(buckets.get(2).getKey().contains(":upload-intent:room:"));
            assertTrue(buckets.get(2).getKey().endsWith(TokenUtil.sha256("test-session")));
            assertTrue(buckets.stream().noneMatch(bucket -> bucket.getKey().contains("test-session")));
            return true;
        }));
    }

    @ParameterizedTest
    @ValueSource(strings = {"zero-size", "bad-uuid", "empty-filename"})
    void rejectsInvalidMetadataBeforeCallingService(String kind) throws Exception {
        String body = switch (kind) {
            case "zero-size" -> BODY.replace("102400", "0");
            case "bad-uuid" -> BODY.replace("cd310ef1-2b95-4df0-9824-af65c77ba1a8", "invalid");
            default -> BODY.replace("demo.png", "");
        };
        mvc.perform(post("/api/v1/rooms/room/attachments").header("X-Session-Token", "test-session")
                        .contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(service);
    }

    @Test
    void missingTokenReachesServiceAuthenticationAndReturns403() throws Exception {
        when(service.createIntent(eq("room"), isNull(), any())).thenThrow(new SecurityException("Missing token"));
        mvc.perform(post("/api/v1/rooms/room/attachments").contentType("application/json").content(BODY))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.success").value(false));
        verify(limiter).consume(argThat(buckets -> buckets.size() == 2));
    }

    @Test
    void rateLimitRejectsBeforeCreatingIntent() throws Exception {
        doThrow(new RateLimitExceededException(1501)).when(limiter).consume(anyList());
        mvc.perform(post("/api/v1/rooms/room/attachments").header("X-Session-Token", "test-session")
                        .contentType("application/json").content(BODY))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "2"))
                .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(service);
    }

    @Test
    void redisFailureRejectsBeforeCreatingIntent() throws Exception {
        doThrow(new RateLimitUnavailableException()).when(limiter).consume(anyList());
        mvc.perform(post("/api/v1/rooms/room/attachments").header("X-Session-Token", "test-session")
                        .contentType("application/json").content(BODY))
                .andExpect(status().isServiceUnavailable()).andExpect(header().string("Retry-After", "1"));
        verifyNoInteractions(service);
    }

    @Test
    void rawUploadUsesContentBucketAndReturnsProcessingWithoutExposingStorageKey() throws Exception {
        when(contentService.upload(eq("room"), eq("test-session"), eq("public-id"), eq(3L), any()))
                .thenReturn(new UploadContentResponse("public-id", AttachmentState.PROCESSING, 3));
        mvc.perform(put("/api/v1/rooms/room/attachments/public-id/content")
                        .header("X-Session-Token", "test-session")
                        .contentType("application/octet-stream").content(new byte[]{1, 2, 3}))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("PROCESSING"))
                .andExpect(jsonPath("$.data.sizeBytes").value(3))
                .andExpect(jsonPath("$.data.storageKey").doesNotExist());
        verify(limiter).consume(argThat(buckets -> buckets.size() == 3
                && buckets.get(2).getPolicy() == properties.getUploadContent()
                && buckets.get(2).getKey().contains(":upload-content:room:")));
        verifyNoInteractions(service);
    }

    @Test
    void contentRateLimitPreventsReadingUpload() throws Exception {
        doThrow(new RateLimitExceededException(1000)).when(limiter).consume(anyList());
        mvc.perform(put("/api/v1/rooms/room/attachments/public-id/content")
                        .header("X-Session-Token", "test-session")
                        .contentType("application/octet-stream").content(new byte[]{1, 2, 3}))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "1"));
        verifyNoInteractions(contentService);
    }

    @Test
    void contentEndpointRejectsJsonInsteadOfBinary() throws Exception {
        mvc.perform(put("/api/v1/rooms/room/attachments/public-id/content")
                        .header("X-Session-Token", "test-session")
                        .contentType("application/json").content("{}"))
                .andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(contentService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"content", "thumbnail"})
    void downloadRoutesDelegateSelectionToServiceAndKeepHttpHeaders(String route) throws Exception {
        boolean thumbnail = route.equals("thumbnail");
        byte[] bytes = new byte[]{1, 2, 3};
        when(accessService.openContent("room", "test-session", "public-id", thumbnail)).thenReturn(
                new com.eventchat.modules.attachment.model.AttachmentDownload("notes.pdf",
                        thumbnail ? "image/jpeg" : "application/pdf", thumbnail, new java.io.ByteArrayInputStream(bytes)));
        mvc.perform(get("/api/v1/rooms/room/attachments/public-id/" + route).header("X-Session-Token", "test-session"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith(thumbnail ? "inline" : "attachment")))
                .andExpect(content().bytes(bytes));
        verify(accessService).openContent("room", "test-session", "public-id", thumbnail);
        verifyNoInteractions(service, contentService, limiter);
    }

    @Test
    void unavailableDownloadStorageReturns503() throws Exception {
        when(accessService.openContent("room", "test-session", "public-id", false)).thenThrow(
                new com.eventchat.common.exception.AttachmentStorageException(new java.io.IOException("Unavailable")));
        mvc.perform(get("/api/v1/rooms/room/attachments/public-id/content").header("X-Session-Token", "test-session"))
                .andExpect(status().isServiceUnavailable()).andExpect(header().string("Retry-After", "1"));
    }
}
