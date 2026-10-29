package com.eventchat.modules.attachment.config;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties("app.upload.scanner")
public class AttachmentScanProperties {
    @NotBlank private String host = "localhost";
    @Min(1) @Max(65535) private int port = 3310;
    @Min(100) private int timeoutMillis = 15000;
    @Min(1) private long maxImagePixels = 16000000;
}
