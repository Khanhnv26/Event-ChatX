package com.eventchat.modules.attachment.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.dto.response.UploadContentResponse;
import com.eventchat.modules.attachment.service.AttachmentContentService;
import com.eventchat.modules.attachment.service.AttachmentService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;
    private final AttachmentContentService attachmentContentService;

    @PutMapping(value = "/{publicId}/content", consumes = "application/octet-stream")
    public ResponseEntity<ApiResponse<UploadContentResponse>> uploadContent(
            @PathVariable String slug,
            @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            HttpServletRequest request) throws IOException {
        UploadContentResponse response = attachmentContentService.upload(slug, sessionToken, publicId,
                request.getContentLengthLong(), request.getInputStream());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UploadIntentResponse>> createIntent(@PathVariable String slug,
                                                                          @RequestHeader(value = "X-Session-Token", required = false) String rawSessionToken,
                                                                          @Valid @RequestBody CreateUploadIntentRequest request) {
        UploadIntentResponse response = attachmentService.createIntent(slug, rawSessionToken, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }


}
