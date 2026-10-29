package com.eventchat.infrastructure.storage.service.impl;

import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.upload.storage.provider", havingValue = "r2")
public class R2StorageServiceImpl implements StorageService {

    private final S3Client s3Client;
    private final String bucketName;
    private final long maxObjectBytes;

    public R2StorageServiceImpl(StorageProperties properties) {
        this.bucketName = Objects.requireNonNull(properties.getBucket(), "R2 bucket name must be configured");
        this.maxObjectBytes = properties.getMaxObjectBytes();

        String endpoint = String.format("https://%s.r2.cloudflarestorage.com",
                Objects.requireNonNull(properties.getAccountId(), "R2 account ID must be configured"));

        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                Objects.requireNonNull(properties.getAccessKeyId(), "R2 access key ID must be configured"),
                Objects.requireNonNull(properties.getSecretAccessKey(), "R2 secret access key must be configured")
        );

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .region(Region.of("auto"))
                .build();

        log.info("Khởi tạo Cloudflare R2 Storage thành công cho bucket: {}", bucketName);
    }

    @Override
    public StoredObject put(InputStream input, long maxBytes) throws IOException {
        return put(UUID.randomUUID().toString(), input, maxBytes);
    }

    @Override
    public StoredObject put(String key, InputStream input, long maxBytes) throws IOException {
        Objects.requireNonNull(input, "Input");
        if (maxBytes <= 0 || maxBytes > maxObjectBytes) {
            throw new IllegalArgumentException("Giới hạn từng tệp không hợp lệ");
        }

        byte[] bytes = input.readAllBytes();
        if (bytes.length > maxBytes) {
            throw new IllegalArgumentException("Kích thước tệp vượt quá giới hạn");
        }

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentLength((long) bytes.length)
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(bytes));

        String sha256 = calculateSha256(bytes);
        return new StoredObject(key, bytes.length, sha256);
    }

    @Override
    public StoredObject replace(String key, InputStream input, long maxBytes) throws IOException {
        return put(key, input, maxBytes);
    }

    @Override
    public InputStream open(String key) throws IOException {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        return s3Client.getObject(request);
    }

    @Override
    public boolean delete(String key) throws IOException {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        s3Client.deleteObject(request);
        return true;
    }

    private String calculateSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }
}
