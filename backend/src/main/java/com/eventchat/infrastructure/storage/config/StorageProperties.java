package com.eventchat.infrastructure.storage.config;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Validated
@Setter
@Getter
@Component
@ConfigurationProperties(prefix = "app.upload.storage")
public class StorageProperties {

    private String provider = "local";

    private String root = "./artifacts/uploads";

    @Min(1)
    private Long maxObjectBytes = 20L * 1024 * 1024;

    @Min(0)
    private long minFreeBytes = 64L * 1024 * 1024;

    private String accountId;
    private String accessKeyId;
    private String secretAccessKey;
    private String bucket;
}
