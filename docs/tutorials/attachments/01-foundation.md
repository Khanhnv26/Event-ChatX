# Tự làm upload ảnh và file — Chặng 1: schema và local storage

Dự án: D:/event_chat. Đối chiếu code ngày 2026-10-28, Java 21 / Spring Boot 3.3.4 / Flyway hiện có V1–V6.

Đây là hướng dẫn để bạn tự viết. Mã dưới đây chưa được chép vào backend đang chạy và chưa migrate database của bạn. Không cần thêm thư viện ảnh, Tika hoặc ClamAV trong chặng này.

## Mục tiêu và lộ trình

Sau chặng này bạn có thể lưu, đọc và xóa byte qua StorageService; file quá lớn hoặc stream lỗi được dọn; có schema để làm upload intent ở chặng 2. Chặng này chưa có endpoint nhận upload và chưa kiểm tra file có phải ảnh/tài liệu hợp lệ.

Các chặng nối tiếp: (2) entity/repository + API tạo intent và quota; (3) nhận stream, scan/thumbnail và API tải có quyền; (4) gắn vào tin nhắn và retry SQL/Mongo; (5) picker/progress/preview/modal ở frontend; (6) cleanup, backup, proxy và kiểm thử production. Chi tiết phạm vi nằm trong [kế hoạch](../../plans/chat-attachments.md).

## Cách thực hiện

1. Trong IntelliJ, tạo đúng package dưới backend/src/main/java và test dưới backend/src/test/java. Mỗi public class/interface/record bên dưới là một file riêng.
2. Viết các file Java theo thứ tự trong bài. Dùng Alt+Enter để import nếu bạn gõ từng phần; không đổi package để gom mọi thứ vào một file.
3. Thêm cấu hình application.properties ở phần cuối, sau đó chạy riêng test LocalStorageServiceTest. Test dùng thư mục tạm nên không cần MySQL/Mongo/Redis/RabbitMQ đang hoạt động.
4. Khi Java test đã qua, tạo migration V7 và chạy app với database DEV/TEST để Flyway áp dụng. Nếu repository đã có V7 mới do bạn vừa tạo, chọn số migration kế tiếp; không sửa V1–V6.
5. Đối chiếu checklist cuối bài trước khi chuyển sang API. Không tự thêm một static /uploads public hoặc endpoint trả file bằng tên người dùng nhập.

## Cấu hình storage

Tạo file: `D:/event_chat/backend/src/main/java/com/eventchat/infrastructure/storage/config/StorageProperties.java`

```java
package com.eventchat.infrastructure.storage.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "app.upload.storage")
public class StorageProperties {
    @NotBlank
    private String root = "./artifacts/uploads";

    @Min(1)
    private long maxObjectBytes = 20L * 1024 * 1024;
}
```

## Kết quả lưu byte

Tạo file: `D:/event_chat/backend/src/main/java/com/eventchat/infrastructure/storage/model/StoredObject.java`

```java
package com.eventchat.infrastructure.storage.model;

public record StoredObject(String key, long sizeBytes, String sha256) {
}
```

## Lỗi vượt dung lượng

Tạo file: `D:/event_chat/backend/src/main/java/com/eventchat/common/exception/UploadTooLargeException.java`

```java
package com.eventchat.common.exception;

public class UploadTooLargeException extends RuntimeException {
    public UploadTooLargeException(long maxBytes) {
        super("Tệp vượt quá giới hạn " + maxBytes + " byte");
    }
}
```

## Interface lưu trữ

Tạo file: `D:/event_chat/backend/src/main/java/com/eventchat/infrastructure/storage/service/StorageService.java`

```java
package com.eventchat.infrastructure.storage.service;

import com.eventchat.infrastructure.storage.model.StoredObject;
import java.io.IOException;
import java.io.InputStream;

public interface StorageService {
    StoredObject put(InputStream input, long maxBytes) throws IOException;
    InputStream open(String key) throws IOException;
    boolean delete(String key) throws IOException;
}
```

## Adapter lưu trên ổ đĩa

Tạo file: `D:/event_chat/backend/src/main/java/com/eventchat/infrastructure/storage/service/impl/LocalStorageService.java`

Luồng: sinh key ngẫu nhiên → tạo file .part → đọc từng khối 8 KiB và giới hạn byte → đóng output → đổi sang tên chính thức. finally dọn phần tạm kể cả khi lỗi. Service không đóng InputStream của caller; controller ở chặng sau sẽ sở hữu và đóng stream đó.

Thư mục storage là thư mục riêng do ứng dụng quản lý, không cho người dùng hoặc tiến trình không tin cậy ghi vào. open từ chối symlink; key phải là UUID canonical, không phải tên file/path. Storage key là dữ liệu nội bộ và không thay thế kiểm tra quyền phòng.

```java
package com.eventchat.infrastructure.storage.service.impl;

import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.StorageService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

@Service
public class LocalStorageService implements StorageService {
    private final Path root;
    private final long maxObjectBytes;

    public LocalStorageService(StorageProperties properties) throws IOException {
        if (properties.getRoot() == null || properties.getRoot().isBlank()) {
            throw new IllegalArgumentException("Thiếu thư mục lưu tệp");
        }
        if (properties.getMaxObjectBytes() <= 0) {
            throw new IllegalArgumentException("Giới hạn lưu tệp phải lớn hơn 0");
        }
        Path configured = Path.of(properties.getRoot()).toAbsolutePath().normalize();
        Files.createDirectories(configured);
        root = configured.toRealPath();
        maxObjectBytes = properties.getMaxObjectBytes();
    }

    @Override
    public StoredObject put(InputStream input, long maxBytes) throws IOException {
        Objects.requireNonNull(input, "input");
        if (maxBytes <= 0 || maxBytes > maxObjectBytes) {
            throw new IllegalArgumentException("Giới hạn từng tệp không hợp lệ");
        }

        String key = UUID.randomUUID().toString();
        Path destination = resolveKey(key);
        Path temporary = Files.createTempFile(root, ".upload-", ".part");
        MessageDigest digest = sha256Digest();
        long size = 0;

        try {
            try (OutputStream output = Files.newOutputStream(
                    temporary, StandardOpenOption.WRITE,
                    StandardOpenOption.TRUNCATE_EXISTING)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (count == 0) continue;
                    if (count > maxBytes - size) {
                        throw new UploadTooLargeException(maxBytes);
                    }
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);
                    size += count;
                }
            }
            if (size == 0) {
                throw new IllegalArgumentException("Không nhận tệp rỗng");
            }

            // Publish only after writing and closing the temporary file.
            // No REPLACE_EXISTING: an existing object must not be overwritten.
            Files.move(temporary, destination);
            return new StoredObject(
                    key, size, HexFormat.of().formatHex(digest.digest()));
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    @Override
    public InputStream open(String key) throws IOException {
        Path path = resolveKey(key);
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new java.nio.file.NoSuchFileException(key);
        }
        return Files.newInputStream(
                path, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
    }

    @Override
    public boolean delete(String key) throws IOException {
        return Files.deleteIfExists(resolveKey(key));
    }

    private Path resolveKey(String key) {
        if (key == null) throw new IllegalArgumentException("Thiếu storage key");
        UUID parsed;
        try {
            parsed = UUID.fromString(key);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }
        if (!parsed.toString().equals(key)) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }
        Path candidate = root.resolve(key).normalize();
        if (!candidate.getParent().equals(root)) {
            throw new IllegalArgumentException("Storage key không hợp lệ");
        }
        return candidate;
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Không hỗ trợ SHA-256", ex);
        }
    }
}
```

## Test storage độc lập

Tạo file: `D:/event_chat/backend/src/test/java/com/eventchat/infrastructure/storage/LocalStorageServiceTest.java`

```java
package com.eventchat.infrastructure.storage;

import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.infrastructure.storage.model.StoredObject;
import com.eventchat.infrastructure.storage.service.impl.LocalStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LocalStorageServiceTest {
    @TempDir Path directory;

    private LocalStorageService storage() throws IOException {
        StorageProperties config = new StorageProperties();
        config.setRoot(directory.resolve("uploads").toString());
        config.setMaxObjectBytes(20L * 1024 * 1024);
        return new LocalStorageService(config);
    }

    private long countFiles() throws IOException {
        try (var files = Files.list(directory.resolve("uploads"))) {
            return files.count();
        }
    }

    @Test
    void storesReadsAndHashesBytes() throws IOException {
        var service = storage();
        byte[] bytes = "hello".getBytes(StandardCharsets.UTF_8);
        StoredObject object = service.put(new ByteArrayInputStream(bytes), 100);

        assertEquals(5, object.sizeBytes());
        assertEquals(
                "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
                object.sha256());
        try (InputStream input = service.open(object.key())) {
            assertArrayEquals(bytes, input.readAllBytes());
        }
        assertEquals(1, countFiles());
    }

    @Test
    void rejectsOversizedStreamAndRemovesTemporaryFile() throws IOException {
        var service = storage();
        assertThrows(UploadTooLargeException.class,
                () -> service.put(new ByteArrayInputStream(new byte[4]), 3));
        assertEquals(0, countFiles());
    }

    @Test
    void removesTemporaryFileAfterReadFailure() throws IOException {
        var service = storage();
        InputStream broken = new InputStream() {
            @Override public int read() throws IOException {
                throw new IOException("Simulated interrupted upload");
            }
        };
        assertThrows(IOException.class, () -> service.put(broken, 100));
        assertEquals(0, countFiles());
    }

    @Test
    void rejectsEmptyFile() throws IOException {
        var service = storage();
        assertThrows(IllegalArgumentException.class,
                () -> service.put(new ByteArrayInputStream(new byte[0]), 100));
        assertEquals(0, countFiles());
    }

    @Test
    void rejectsPathsInsteadOfStorageKeys() throws IOException {
        var service = storage();
        for (String key : new String[] {
                "../secret", "/etc/passwd", "C:\\Windows\\win.ini",
                "1-1-1-1-1", "not-a-uuid" }) {
            assertThrows(IllegalArgumentException.class, () -> service.open(key));
            assertThrows(IllegalArgumentException.class, () -> service.delete(key));
        }
    }

    @Test
    void deletesIdempotently() throws IOException {
        var service = storage();
        var object = service.put(new ByteArrayInputStream(new byte[]{1}), 100);
        assertTrue(service.delete(object.key()));
        assertFalse(service.delete(object.key()));
    }

    @Test
    void usesDifferentKeysForSeparateUploads() throws IOException {
        var service = storage();
        var first = service.put(new ByteArrayInputStream(new byte[]{1}), 100);
        var second = service.put(new ByteArrayInputStream(new byte[]{1}), 100);
        assertNotEquals(first.key(), second.key());
        assertEquals(2, countFiles());
    }
}
```

## Migration tạo bảng

Tạo file: `D:/event_chat/backend/src/main/resources/db/migration/V7__add_attachments.sql`

Migration chỉ tạo bảng, không xóa bảng/dữ liệu cũ. Bảng attachments dùng id số nội bộ để phù hợp BaseEntity và public_id UUID cho API. uploader_session_id là tham chiếu lịch sử được kiểm tra ở service, chưa đặt FK tới room_sessions để không vô tình chặn thứ tự purge phiên hiện tại.

FK room dùng RESTRICT có chủ đích: trước khi bật upload thực tế, chặng cleanup phải enqueue công việc xóa và xử lý metadata trước khi purge phòng. Không đổi thành CASCADE để che lỗi trong khi file vật lý còn sót. Outbox xóa không có FK tới phòng để công việc không mất khi phòng bị xóa.

```sql
CREATE TABLE room_attachment_quotas (
    room_id BIGINT NOT NULL PRIMARY KEY,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    stored_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_attachment_quota_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT ck_attachment_quota_nonnegative
        CHECK (reserved_bytes >= 0 AND stored_bytes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL,
    room_id BIGINT NOT NULL,
    uploader_session_id BIGINT NOT NULL,
    client_upload_id VARCHAR(64) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    declared_content_type VARCHAR(127) NOT NULL,
    detected_content_type VARCHAR(127) NULL,
    expected_size_bytes BIGINT NOT NULL,
    actual_size_bytes BIGINT NULL,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    charged_bytes BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(80) NULL,
    thumbnail_key VARCHAR(80) NULL,
    sha256 CHAR(64) NULL,
    width_px INT NULL,
    height_px INT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'RESERVED',
    bound_client_message_id VARCHAR(64) NULL,
    error_code VARCHAR(64) NULL,
    upload_expires_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_attachment_public_id UNIQUE (public_id),
    CONSTRAINT uk_attachment_client_upload
        UNIQUE (room_id, uploader_session_id, client_upload_id),
    CONSTRAINT fk_attachment_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT ck_attachment_sizes CHECK (
        expected_size_bytes > 0
        AND (actual_size_bytes IS NULL OR actual_size_bytes >= 0)
        AND reserved_bytes >= 0 AND charged_bytes >= 0
    ),
    INDEX idx_attachment_cleanup (state, expires_at),
    INDEX idx_attachment_upload_expiry (state, upload_expires_at),
    INDEX idx_attachment_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachment_delete_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    storage_key VARCHAR(80) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error_code VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_attachment_delete_key UNIQUE (storage_key),
    INDEX idx_attachment_delete_due (state, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Khai báo lỗi HTTP

Trong D:/event_chat/backend/src/main/java/com/eventchat/common/exception/GlobalExceptionHandler.java, thêm method bên trong class. Không tạo một GlobalExceptionHandler thứ hai.

```java
@ExceptionHandler(UploadTooLargeException.class)
public ResponseEntity<ApiResponse<Void>> handleUploadTooLarge(
        UploadTooLargeException ex) {
    return ResponseEntity.status(413)
            .body(ApiResponse.error(ex.getMessage()));
}
```

UploadTooLargeException ở cùng package nên không cần import. ApiResponse/ResponseEntity/ExceptionHandler đã có sẵn trong class hiện tại.

Không thêm handler IOException chung ở chặng này: lỗi I/O của upload sẽ được chuyển thành lỗi storage có nghĩa cụ thể ở service/API chặng sau.

## Cấu hình và thư mục dữ liệu

Thêm vào D:/event_chat/backend/src/main/resources/application.properties:

```properties
app.upload.storage.root=./artifacts/uploads
app.upload.storage.max-object-bytes=20971520
```

Đường dẫn tương đối tính từ working directory của Java, không phải luôn từ thư mục backend. Để kết quả rõ ràng trong IntelliJ, vào Run → Edit Configurations → Environment variables và đặt:

```text
APP_UPLOAD_STORAGE_ROOT=D:/event_chat/artifacts/uploads-dev
```

Spring Boot tự ánh xạ biến APP_UPLOAD_STORAGE_ROOT vào app.upload.storage.root. Khi chạy Docker production, giá trị này sẽ là /var/lib/eventchat/uploads và có volume riêng; chưa cần thay compose ở chặng này.

Repo hiện đã ignore artifacts/; kiểm tra lại bằng:

```powershell
git check-ignore artifacts/uploads-dev/example
```

Không lưu vào frontend/public, dist hoặc src/main/resources/static. Không thêm gitignore cho file SQL/Java vừa viết.

## Chạy test Java

Nếu IntelliJ nhận JDK 21 và Maven: mở LocalStorageServiceTest, bấm biểu tượng chạy cạnh class.

Hoặc chạy ở terminal PowerShell trong D:/event_chat/backend. Nếu Maven chưa có trong PATH:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.10'
$maven = 'C:\Program Files\JetBrains\IntelliJ IDEA 2026.1\plugins\maven-plugin\lib\maven3\bin\mvn.cmd'
& $maven '-Dtest=LocalStorageServiceTest' test
```

Nếu mvn đã có trong PATH thì dùng mvn -Dtest=LocalStorageServiceTest test. Test này không dùng Mockito và không gọi database.

Kết quả mong đợi: Tests run: 7, Failures: 0, Errors: 0.

Không sửa test để bỏ qua lỗi. Đặc biệt cần giữ các ca: quá giới hạn, stream đứt, file rỗng, path không hợp lệ và retry xóa.

## Áp dụng migration trên database DEV/TEST

1. Đảm bảo cấu hình datasource chỉ tới database phát triển bạn muốn dùng; không dán mật khẩu vào terminal hoặc tài liệu.
2. Start backend từ IntelliJ như hiện tại. Flyway trong dự án sẽ tự nhận migration mới khi startup.
3. Kiểm tra log có thông báo migrate tới version 7, sau đó kiểm tra trong MySQL Workbench:

```sql
SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank DESC
LIMIT 3;

SHOW TABLES LIKE 'attachments';
SHOW TABLES LIKE 'room_attachment_quotas';
SHOW TABLES LIKE 'attachment_delete_tasks';
```

Nếu Flyway báo checksum mismatch ở V1–V6, dừng và kiểm tra file cũ đã bị sửa; không tự dùng repair hoặc xóa flyway_schema_history. Nếu backend khởi động lỗi Redis/RabbitMQ, đó là dependency runtime của app, không phải bằng chứng storage test lỗi.

Bài này chưa tạo entity JPA cho các bảng mới. Extra tables không yêu cầu Hibernate phải có entity ngay; mapping sẽ làm ở chặng 2. Chưa bật upload nên không có attachment mới được ghi vào bảng.

## Tự giải thích lại các điểm sau

- original_filename để hiển thị; storage key để truy cập nội bộ. Vì sao không dùng tên gốc làm đường dẫn?
- Vì sao kiểm tra size trong vòng lặp thay vì tin Content-Length?
- Vì sao phải đóng output trước khi đổi tên file?
- Vì sao .part vẫn cần job dọn khi tiến trình bị kill trước finally?
- StorageService chưa có auth: vì sao controller không được gọi open bằng key do client tùy ý đưa vào?
- Chuyện gì xảy ra nếu database lưu metadata lỗi sau khi file đã được put? Chặng sau phải có cleanup/reconciliation, không giả định transaction SQL rollback được filesystem.

## Điều kiện chuyển sang chặng 2

- Tạo đúng 5 file Java production phía trên và 1 file test.
- Có handler 413 và config storage.
- Bảy test qua.
- Backend compile; Flyway DEV/TEST áp dụng migration mới thành công khi bạn chọn thực hiện.
- Chưa có đường dẫn public tải trực tiếp file.

Mã Java storage ở trên đã compile và chạy trong project thử độc lập tại artifacts/upload-storage-lesson-check: 7 test, 0 failure, 0 error trên JDK 21. Thư mục tạm của JVM được đặt trong workspace để phù hợp sandbox Windows. Schema SQL trong bài chưa được chạy trên database thật của bạn; cần thực hiện và kiểm tra riêng như các bước trên.

