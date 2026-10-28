package com.eventchat.infrastructure.storage.service.impl;

import com.eventchat.infrastructure.storage.config.StorageProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class StorageServiceImplTest {
    @TempDir Path root;

    @Test
    void preassignedKeyNeverOverwritesExistingFile() throws Exception {
        StorageServiceImpl storage = storage(0);
        String key = UUID.randomUUID().toString();
        storage.put(key, new ByteArrayInputStream(new byte[]{1}), 1);
        assertThatThrownBy(() -> storage.put(key, new ByteArrayInputStream(new byte[]{2}), 1))
                .isInstanceOf(IOException.class);
        assertThat(Files.readAllBytes(root.resolve(key))).containsExactly(1);
        assertThat(root.resolve(".upload-" + key + ".part")).doesNotExist();
    }

    @Test
    void rejectsUntrustedKeysBeforeCreatingFiles() throws Exception {
        StorageServiceImpl storage = storage(0);
        assertThatThrownBy(() -> storage.put("../escape", new ByteArrayInputStream(new byte[]{1}), 1))
                .isInstanceOf(IllegalArgumentException.class);
        try (java.util.stream.Stream<Path> files = Files.list(root)) {
            assertThat(files.count()).isZero();
        }
    }

    @Test
    void deletesCrashedPartialFileUsingPersistedKey() throws Exception {
        StorageServiceImpl storage = storage(0);
        String key = UUID.randomUUID().toString();
        Path partial = root.resolve(".upload-" + key + ".part");
        Files.write(partial, new byte[]{1});
        assertThat(storage.delete(key)).isTrue();
        assertThat(partial).doesNotExist();
        assertThat(storage.delete(key)).isFalse();
    }

    @Test
    void refusesToStartWhenFreeSpaceReserveCannotBeMet() throws Exception {
        StorageServiceImpl storage = storage(Long.MAX_VALUE);
        assertThatThrownBy(() -> storage.put(UUID.randomUUID().toString(), new ByteArrayInputStream(new byte[]{1}), 1))
                .isInstanceOf(IOException.class);
        try (java.util.stream.Stream<Path> files = Files.list(root)) {
            assertThat(files.count()).isZero();
        }
    }

    private StorageServiceImpl storage(long minFreeBytes) throws IOException {
        StorageProperties properties = new StorageProperties();
        properties.setRoot(root.toString());
        properties.setMinFreeBytes(minFreeBytes);
        return new StorageServiceImpl(properties);
    }
}
