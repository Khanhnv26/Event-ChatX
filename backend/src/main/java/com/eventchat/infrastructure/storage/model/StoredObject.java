package com.eventchat.infrastructure.storage.model;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class StoredObject {
    private String key;
    private long sizeBytes;
    private String sha256;
}
