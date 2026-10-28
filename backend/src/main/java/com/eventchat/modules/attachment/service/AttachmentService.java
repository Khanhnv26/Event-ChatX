package com.eventchat.modules.attachment.service;

import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;

public interface AttachmentService {
    UploadIntentResponse createIntent(String slug, String rawSessionToken, CreateUploadIntentRequest request);
}
