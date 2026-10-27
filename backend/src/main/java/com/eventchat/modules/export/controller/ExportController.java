package com.eventchat.modules.export.controller;

import com.eventchat.common.response.ApiResponse;
import com.eventchat.modules.export.dto.response.RoomExportResponse;
import com.eventchat.modules.export.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/rooms/{slug}/export")
public class ExportController {

    private final ExportService exportService;

    @GetMapping
    public ResponseEntity<ApiResponse<RoomExportResponse>> exportRoomSummary(@PathVariable String slug) {
        RoomExportResponse response = exportService.exportRoomSummary(slug);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/markdown")
    public ResponseEntity<byte[]> downloadMarkdownSummary(@PathVariable String slug) {
        RoomExportResponse response = exportService.exportRoomSummary(slug);
        byte[] content = response.getMarkdownSummary().getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"eventchat-summary-" + slug + ".md\"")
                .contentType(new MediaType("text", "markdown", StandardCharsets.UTF_8))
                .body(content);
    }
}
