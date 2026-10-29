package com.eventchat.modules.attachment.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.io.InputStream;

@Getter
@AllArgsConstructor
public class AttachmentDownload {
    private final String filename;
    private final String contentType;
    private final boolean inline;
    private final InputStream input;
}
