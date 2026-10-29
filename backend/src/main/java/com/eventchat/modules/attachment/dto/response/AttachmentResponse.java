package com.eventchat.modules.attachment.dto.response;

import com.eventchat.modules.attachment.enums.AttachmentState;
import lombok.*;
import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentResponse {
    private String publicId;
    private String filename;
    private String contentType;
    private long sizeBytes;
    private AttachmentState state;
    private Integer width;
    private Integer height;
    private boolean hasThumbnail;
    private String errorCode;
    private Instant expiresAt;
}
