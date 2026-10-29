package com.eventchat.modules.attachment.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ProcessedAttachment {
    private final String contentType;
    private final byte[] content;
    private final byte[] thumbnail;
    private final Integer width;
    private final Integer height;
}
