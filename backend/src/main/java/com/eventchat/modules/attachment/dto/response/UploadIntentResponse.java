package com.eventchat.modules.attachment.dto.response;

import com.eventchat.modules.attachment.enums.AttachmentState;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UploadIntentResponse {

    private String publicId;
    private AttachmentState state;
    private long sizeBytes;
    private Instant uploadExpiresAt;
}
