package com.eventchat.modules.attachment.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import com.eventchat.modules.attachment.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AttachmentResponse>> upload(
            @PathVariable String slug,
            @RequestHeader(value = "X-Session-Token", required = false) String sessionToken,
            @RequestParam("file") MultipartFile file) throws IOException {

        AttachmentResponse response = attachmentService.upload(slug, sessionToken, file);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{publicId}/content")
    public ResponseEntity<InputStreamResource> downloadContent(
            @PathVariable String slug,
            @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) throws IOException {

        AttachmentDownload download = attachmentService.download(slug, token, publicId, false);
        return createDownloadResponse(download);
    }

    @GetMapping("/{publicId}/thumbnail")
    public ResponseEntity<InputStreamResource> downloadThumbnail(
            @PathVariable String slug,
            @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) throws IOException {

        AttachmentDownload download = attachmentService.download(slug, token, publicId, true);
        return createDownloadResponse(download);
    }

    @DeleteMapping("/{publicId}")
    public ApiResponse<Void> delete(
            @PathVariable String slug,
            @PathVariable String publicId,
            @RequestHeader(value = "X-Session-Token", required = false) String token) {

        attachmentService.delete(slug, token, publicId);
        return ApiResponse.success(null);
    }

    private ResponseEntity<InputStreamResource> createDownloadResponse(AttachmentDownload download) {
        ContentDisposition disposition = download.isInline()
                ? ContentDisposition.inline().build()
                : ContentDisposition.attachment().filename(download.getFilename(), StandardCharsets.UTF_8).build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(download.getContentType()))
                .body(new InputStreamResource(download.getInput()));
    }
}
