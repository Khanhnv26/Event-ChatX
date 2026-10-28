package com.eventchat.modules.attachment.dto.response;

import com.eventchat.modules.attachment.enums.AttachmentState;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UploadContentResponse {
    private final String publicId;
    private final AttachmentState state;
    private final long sizeBytes;
}
