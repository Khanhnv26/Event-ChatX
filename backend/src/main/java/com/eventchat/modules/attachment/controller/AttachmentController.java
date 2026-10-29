package com.eventchat.modules.attachment.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.dto.response.UploadContentResponse;
import com.eventchat.modules.attachment.service.AttachmentContentService;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.attachment.service.impl.AttachmentAccessService;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import java.nio.charset.StandardCharsets;
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
    private final AttachmentAccessService attachmentAccessService;

    @GetMapping("/{publicId}")
    public ResponseEntity<ApiResponse<AttachmentResponse>> status(@PathVariable String slug, @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(attachmentAccessService.status(slug, token, publicId)));
    }

    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> cancel(@PathVariable String slug, @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        attachmentAccessService.cancel(slug, token, publicId);
        return ApiResponse.success(null);
    }

    @GetMapping("/{publicId}/content")
    public ResponseEntity<InputStreamResource> downloadContent(@PathVariable String slug, @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        return downloadResponse(attachmentAccessService.openContent(slug, token, publicId, false));
    }

    @GetMapping("/{publicId}/thumbnail")
    public ResponseEntity<InputStreamResource> downloadThumbnail(@PathVariable String slug, @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {
        return downloadResponse(attachmentAccessService.openContent(slug, token, publicId, true));
    }

    private ResponseEntity<InputStreamResource> downloadResponse(AttachmentDownload download) {
        ContentDisposition disposition = download.isInline() ? ContentDisposition.inline().build()
                : ContentDisposition.attachment().filename(download.getFilename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff").header("Content-Disposition", disposition.toString())
                .contentType(MediaType.parseMediaType(download.getContentType()))
                .body(new InputStreamResource(download.getInput()));
    }

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
