package com.eventchat.modules.attachment.service;

import com.eventchat.modules.attachment.dto.response.UploadContentResponse;

import java.io.InputStream;

public interface AttachmentContentService {
    UploadContentResponse upload(String slug, String sessionToken, String publicId,
                                 long contentLength, InputStream input);
}
