package com.eventchat.modules.attachment.config;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "app.upload.attachments")
public class AttachmentProperties {

    @Min(1)
    private long imageMaxBytes = 5L*1024*1024; // 5MB

    @Min(1)
    private long fileMaxBytes = 20L*1024*1024; // 20MB

    @Min(1)
    private long roomQuotaBytes = 200L*1024*1024; // 200MB

    @Min(60)
    private long intentTtlSeconds = 60L * 15; // 15 minutes

    @Min(1)
    private int maxConcurrentUploads = 8;
}
