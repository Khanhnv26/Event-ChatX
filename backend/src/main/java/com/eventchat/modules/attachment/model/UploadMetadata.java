package com.eventchat.modules.attachment.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class UploadMetadata {
    private final String filename;
    private final String contentType;
    private final String extension;
}
