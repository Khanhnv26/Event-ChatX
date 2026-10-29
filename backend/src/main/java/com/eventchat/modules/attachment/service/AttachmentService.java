package com.eventchat.modules.attachment.service;

import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.modules.attachment.model.AttachmentDownload;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface AttachmentService {
    AttachmentResponse upload(String slug, String sessionToken, MultipartFile file) throws IOException;
    AttachmentDownload download(String slug, String sessionToken, String publicId, boolean thumbnail);
    void delete(String slug, String sessionToken, String publicId);
}
