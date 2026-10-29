package com.eventchat.modules.attachment.controller;

import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import com.eventchat.modules.attachment.service.AttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.ByteArrayInputStream;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AttachmentControllerTest {

    private AttachmentService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(AttachmentService.class);
        AttachmentController controller = new AttachmentController(service);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void upload_returnsAttachmentResponse() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.png", "image/png", "fake-image-bytes".getBytes()
        );

        AttachmentResponse response = AttachmentResponse.builder()
                .publicId("att-uuid-123")
                .filename("test.png")
                .contentType("image/png")
                .sizeBytes(file.getSize())
                .state(AttachmentState.READY)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(service.upload(eq("test-room"), any(), any())).thenReturn(response);

        mvc.perform(multipart("/api/v1/rooms/test-room/attachments")
                        .file(file)
                        .header("X-Session-Token", "valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.publicId").value("att-uuid-123"))
                .andExpect(jsonPath("$.data.filename").value("test.png"))
                .andExpect(jsonPath("$.data.state").value("READY"));
    }

    @Test
    void downloadContent_returnsStream() throws Exception {
        AttachmentDownload download = new AttachmentDownload(
                "test.png", "image/png", true, new ByteArrayInputStream("hello".getBytes())
        );

        when(service.download(eq("test-room"), any(), eq("att-123"), eq(false)))
                .thenReturn(download);

        mvc.perform(get("/api/v1/rooms/test-room/attachments/att-123/content")
                        .header("X-Session-Token", "valid-token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
    }

    @Test
    void delete_callsServiceDelete() throws Exception {
        doNothing().when(service).delete(eq("test-room"), any(), eq("att-123"));

        mvc.perform(delete("/api/v1/rooms/test-room/attachments/att-123")
                        .header("X-Session-Token", "valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(service).delete(eq("test-room"), any(), eq("att-123"));
    }
}
