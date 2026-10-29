package com.eventchat.infrastructure.storage.service.impl;
import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;


@Service
public class StorageServiceImpl implements StorageService {

    private final Path root;
    private final long maxObjectBytes;
    private final long minFreeBytes;

    public StorageServiceImpl(StorageProperties properties) throws IOException {
        Path configured = Path.of(properties.getRoot()).toAbsolutePath().normalize();
        Files.createDirectories(configured);
        this.root = configured.toRealPath();
        this.maxObjectBytes = properties.getMaxObjectBytes();
        this.minFreeBytes = properties.getMinFreeBytes();
    }

    @Override
    public StoredObject put(InputStream input, long maxBytes) throws IOException {
        return put(UUID.randomUUID().toString(), input, maxBytes);
    }

    @Override
    public StoredObject put(String key, InputStream input, long maxBytes) throws IOException {
        return write(key, input, maxBytes, false);
    }

    @Override
    public StoredObject replace(String key, InputStream input, long maxBytes) throws IOException {
        return write(key, input, maxBytes, true);
    }

    private StoredObject write(String key, InputStream input, long maxBytes, boolean replace) throws IOException {
        Objects.requireNonNull(input, "Input");

        if(maxBytes <= 0 || maxBytes > maxObjectBytes) {
            throw new IllegalArgumentException("Giới hạn từng tệp không hợp lệ");
        }

        Path destination = resolveKey(key);
        long usableBytes = Files.getFileStore(root).getUsableSpace();
        if (usableBytes < minFreeBytes || maxBytes > usableBytes - minFreeBytes) {
            throw new IOException("Insufficient free upload storage");
        }
        Path temporary = Files.createFile(root.resolve(".upload-" + key + ".part"));
        MessageDigest digest = sha256Digest();
        long size = 0;

        try {
            try (OutputStream output = Files.newOutputStream(temporary, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if(count == 0) continue;
                    if(count > maxBytes - size) {
                        throw new UploadTooLargeException(maxBytes);
                    }
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0,count);
                    size += count;
                }
            }
            if(size == 0) {
                throw new IllegalArgumentException("Tệp tải lên trống");
            }

            if (replace) {
                try {
                    Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException ex) {
                    Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
                }
            } else {
                Files.move(temporary, destination);
            }

            return StoredObject.builder()
                    .key(key)
                    .sizeBytes(size)
                    .sha256(HexFormat.of().formatHex(digest.digest()))
                    .build();

        } finally {
            Files.deleteIfExists(temporary);

        }

    }

    @Override
    public InputStream open(String key) throws IOException {
        Path path = resolveKey(key);
        if(!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new NoSuchFileException(key);
        }
        return Files.newInputStream(path, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
    }

    @Override
    public boolean delete(String key) throws IOException {
        boolean deleted = Files.deleteIfExists(resolveKey(key));
        boolean partialDeleted = Files.deleteIfExists(root.resolve(".upload-" + key + ".part"));
        return deleted || partialDeleted;
    }

    private Path resolveKey(String key) {

        if(key == null) throw new IllegalArgumentException("Thiếu storage key");

        UUID parsed;
        try {
            parsed  = UUID.fromString(key);

        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }

        if(!parsed.toString().equals(key)) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }

        Path candiate = root.resolve(key).normalize();

        if(!candiate.getParent().equals(root)) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }

        return candiate;
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Không thể tạo MessageDigest SHA-256", e);
        }
    }

}
