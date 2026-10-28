# Tự làm upload — Chặng 2B.1: service tạo intent và giữ quota

Mã hướng dẫn theo DTO/entity ngày 2026-10-28. Cập nhật 2026-10-29: service đã được hoàn thiện trực tiếp trong source backend theo yêu cầu, dùng kiểu tường minh, UploadMetadata riêng và luồng chính không tách thành các hàm bọc repository.

## Trước khi viết

Prefix AttachmentProperties phải là app.upload.attachments; request có filename và getFilename(). Bài này thêm 3 exception, 1 model và 2 file service. Chưa mở endpoint HTTP, chưa nhận byte và chưa cần migrate mới.

Tất cả dependency constructor dưới đây là bean Spring (repository hoặc properties), vì vậy @RequiredArgsConstructor phù hợp; không inject Path như storage trước đây.

## Nguyên tắc transaction

- Khóa Room trước; kiểm tra session trực tiếp từ SQL, không lấy uploaderSessionId từ client hoặc dùng cache phiên có thể đã bị thu hồi.
- Kiểm tra lại phòng còn ACTIVE/chưa hết hạn trước khi ghi.
- Retry cùng room/session/clientUploadId với payload giống nhau trả intent cũ, không cộng quota hoặc gia hạn deadline. Payload khác trả conflict.
- Khóa quota và kiểm tra phần dung lượng còn lại trước khi tăng reservedBytes. Tạo quota mới chỉ sau khi đã khóa Room, để tránh race ở dòng quota chưa tồn tại.
- Dữ liệu DB cùng transaction; lỗi tạo attachment rollback cả quota. Không stream file hoặc gọi scanner trong transaction này.

## AttachmentConflictException.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/common/exception/AttachmentConflictException.java`

```java
package com.eventchat.common.exception;

public class AttachmentConflictException extends RuntimeException {
    public AttachmentConflictException(String message) { super(message); }
}
```

## AttachmentQuotaExceededException.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/common/exception/AttachmentQuotaExceededException.java`

```java
package com.eventchat.common.exception;

public class AttachmentQuotaExceededException extends AttachmentConflictException {
    public AttachmentQuotaExceededException() { super("Phòng không còn đủ dung lượng cho tệp này"); }
}
```

## UnsupportedAttachmentTypeException.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/common/exception/UnsupportedAttachmentTypeException.java`

```java
package com.eventchat.common.exception;

public class UnsupportedAttachmentTypeException extends RuntimeException {
    public UnsupportedAttachmentTypeException() { super("Loại tệp không được hỗ trợ"); }
}
```

## AttachmentService.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/service/AttachmentService.java`

```java
package com.eventchat.modules.attachment.service;

import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;

public interface AttachmentService {
    UploadIntentResponse createIntent(
            String slug, String rawSessionToken,
            CreateUploadIntentRequest request);
}
```

## UploadMetadata.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/model/UploadMetadata.java`

Model chứa tên tệp, MIME khai báo và phần mở rộng đã chuẩn hóa. Nội dung file vẫn phải được kiểm tra ở chặng nhận byte. Class không có annotation Spring/JPA; service tạo object này trực tiếp.

```java
package com.eventchat.modules.attachment.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UploadMetadata {
    private final String filename;
    private final String contentType;
    private final String extension;
}
```

## AttachmentServiceImpl.java

Tạo: `D:/event_chat/backend/src/main/java/com/eventchat/modules/attachment/service/impl/AttachmentServiceImpl.java`

Bản này dùng kiểu tường minh, không dùng var hoặc record. Luồng truy vấn, khóa quota và lưu entity nằm trực tiếp trong createIntent, không bọc mỗi thao tác repository trong một hàm riêng. Chỉ giữ helper chuẩn hóa request, kiểm tra trạng thái phòng/retry và map response; validateConfiguration chạy lúc khởi tạo bean. UploadMetadata nằm trong package model riêng.

```java
package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.*;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.entity.*;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.repository.*;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.attachment.model.UploadMetadata;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {
    // Budget for a thumbnail while processing an image. The image processor
    // added later must enforce this bound on its encoded output.
    private static final long THUMBNAIL_BUDGET_BYTES = 512L * 1024;

    private static final Map<String, Set<String>> ALLOWED_TYPES = Map.of(
        "image/jpeg", Set.of("jpg", "jpeg"),
        "image/png", Set.of("png"),
        "application/pdf", Set.of("pdf"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Set.of("docx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Set.of("xlsx"),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation", Set.of("pptx"),
        "text/plain", Set.of("txt"),
        "text/csv", Set.of("csv")
    );

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final AttachmentRepository attachmentRepository;
    private final RoomAttachmentQuotaRepository roomAttachmentQuotaRepository;
    private final AttachmentProperties attachmentProperties;
    private final StorageProperties storageProperties;

    @PostConstruct
    public void validateConfiguration() {
        Long storageLimit = storageProperties.getMaxObjectBytes();

        if (storageLimit == null || storageLimit <= 0) {
            throw new IllegalStateException("Giới hạn storage phải lớn hơn 0");
        }

        long imageLimit = attachmentProperties.getImageMaxBytes();
        long fileLimit = attachmentProperties.getFileMaxBytes();

        if (imageLimit <= 0 || fileLimit < imageLimit || fileLimit > storageLimit) {
            throw new IllegalStateException("Cấu hình giới hạn kích thước tệp không hợp lệ");
        }

        if (attachmentProperties.getRoomQuotaBytes() <= 0) {
            throw new IllegalStateException("Quota phòng phải lớn hơn 0");
        }

        long ttlSeconds = attachmentProperties.getIntentTtlSeconds();
        if (ttlSeconds < 60 || ttlSeconds > 86400) {
            throw new IllegalStateException("Thời hạn intent phải từ 60 đến 86400 giây");
        }
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public UploadIntentResponse createIntent(
            String slug, String rawSessionToken,
            CreateUploadIntentRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new SecurityException("Thiếu phiên tham gia phòng");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
            .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(
                room.getId(), TokenUtil.sha256(rawSessionToken))
            .orElseThrow(() -> new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ"));
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        validateRoomWritable(room, now);

        UploadMetadata metadata = normalizeMetadata(request);

        Optional<Attachment> existingAttachment = attachmentRepository.findByRoom_IdAndUploaderSessionIdAndClientUploadId(
                room.getId(), session.getId(), request.getClientUploadId());
        if (existingAttachment.isPresent()) {
            Attachment existing = existingAttachment.get();
            if (!existing.getOriginalFilename().equals(metadata.getFilename())
                    || !existing.getDeclaredContentType().equals(metadata.getContentType())
                    || existing.getExpectedSizeBytes() != request.getSizeBytes()) {
                throw new AttachmentConflictException("Client upload ID đã được dùng cho một tệp khác");
            }
            validateRetryable(existing, now);
            return toResponse(existing);
        }

        Set<String> extensions = ALLOWED_TYPES.get(metadata.getContentType());
        if (extensions == null || !extensions.contains(metadata.getExtension())) {
            throw new UnsupportedAttachmentTypeException();
        }
        boolean image = metadata.getContentType().startsWith("image/");
        long limit = image ? attachmentProperties.getImageMaxBytes() : attachmentProperties.getFileMaxBytes();
        if (request.getSizeBytes() > limit) {
            throw new UploadTooLargeException(limit);
        }

        // Reserve the input plus bounded output/thumbnail space while processing
        // an image. Later, unused reservation must be released exactly once.
        long reservation = request.getSizeBytes();
        if (image) {
            reservation = Math.addExact(reservation,
                Math.addExact(attachmentProperties.getImageMaxBytes(), THUMBNAIL_BUDGET_BYTES));
        }

        RoomAttachmentQuota quota = roomAttachmentQuotaRepository.findForUpdate(room.getId())
            .orElseGet(() -> {
                RoomAttachmentQuota created = new RoomAttachmentQuota();
                created.setRoomId(room.getId());
                return roomAttachmentQuotaRepository.saveAndFlush(created);
            });
        long ceiling = attachmentProperties.getRoomQuotaBytes();
        long stored = quota.getStoredBytes();
        long reserved = quota.getReservedBytes();
        if (stored < 0 || reserved < 0) {
            throw new IllegalStateException("Quota không hợp lệ");
        }
        if (stored > ceiling || reserved > ceiling - stored
                || reservation > ceiling - stored - reserved) {
            throw new AttachmentQuotaExceededException();
        }

        now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        validateRoomWritable(room, now);
        long seconds = Math.min(attachmentProperties.getIntentTtlSeconds(),
            Duration.between(now, room.getExpiresAt()).getSeconds());
        if (seconds <= 0) {
            throw new AttachmentConflictException("Phòng sắp hết hạn");
        }

        Attachment attachment = Attachment.builder()
            .publicId(UUID.randomUUID().toString())
            .room(room)
            .uploaderSessionId(session.getId())
            .clientUploadId(request.getClientUploadId())
            .originalFilename(metadata.getFilename())
            .declaredContentType(metadata.getContentType())
            .expectedSizeBytes(request.getSizeBytes())
            .reservedBytes(reservation)
            .chargedBytes(0)
            .state(AttachmentState.RESERVED)
            .uploadExpiresAt(now.plusSeconds(seconds))
            .expiresAt(room.getExpiresAt().plus(Duration.ofDays(7)))
            .build();

        quota.setReservedBytes(reserved + reservation);
        roomAttachmentQuotaRepository.save(quota);
        attachmentRepository.saveAndFlush(attachment);
        return toResponse(attachment);
    }

    private static UploadMetadata normalizeMetadata(CreateUploadIntentRequest request) {
        if (request == null || request.getClientUploadId() == null
                || request.getFilename() == null || request.getDeclaredContentType() == null
                || request.getSizeBytes() == null || request.getSizeBytes() <= 0) {
            throw new IllegalArgumentException("Thông tin upload không hợp lệ");
        }
        try {
            if (!UUID.fromString(request.getClientUploadId()).toString()
                    .equals(request.getClientUploadId())) {
                throw new IllegalArgumentException("Client upload ID không hợp lệ");
            }
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Client upload ID không hợp lệ");
        }
        String filename = request.getFilename().strip();
        if (filename.isEmpty() || filename.length() > 255
                || filename.codePoints().anyMatch(Character::isISOControl)
                || filename.contains("/") || filename.contains("\\") || filename.contains(":")) {
            throw new IllegalArgumentException("Tên tệp không hợp lệ");
        }
        String contentType = request.getDeclaredContentType().strip().toLowerCase(Locale.ROOT);
        if (contentType.isEmpty() || contentType.length() > 127) {
            throw new IllegalArgumentException("Loại tệp khai báo không hợp lệ");
        }
        int dot = filename.lastIndexOf('.');
        String extension = "";
        if (dot > 0 && dot < filename.length() - 1) {
            extension = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        }
        return new UploadMetadata(filename, contentType, extension);
    }

    private static void validateRoomWritable(Room room, Instant now) {
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !room.getExpiresAt().isAfter(now)) {
            throw new AttachmentConflictException("Phòng đã đóng hoặc hết hạn");
        }
    }

    private static void validateRetryable(Attachment attachment, Instant now) {
        AttachmentState state = attachment.getState();
        if (state == AttachmentState.REJECTED || state == AttachmentState.EXPIRED
                || state == AttachmentState.DELETING || !attachment.getExpiresAt().isAfter(now)) {
            throw new AttachmentConflictException("Intent không còn sử dụng được; hãy tạo client upload ID mới");
        }
        if ((state == AttachmentState.RESERVED || state == AttachmentState.UPLOADING
                || state == AttachmentState.PROCESSING)
                && !attachment.getUploadExpiresAt().isAfter(now)) {
            throw new AttachmentConflictException("Intent đã hết hạn; hãy tạo client upload ID mới");
        }
    }

    private static UploadIntentResponse toResponse(Attachment attachment) {
        return UploadIntentResponse.builder()
            .publicId(attachment.getPublicId())
            .state(attachment.getState())
            .sizeBytes(attachment.getExpectedSizeBytes())
            .uploadExpiresAt(attachment.getUploadExpiresAt())
            .build();
    }

}
```

## Phần giữ chỗ ảnh cần hiểu rõ

Với file tài liệu, reservation bằng kích thước đầu vào dự kiến. Với ảnh, bài này giữ thêm tối đa imageMaxBytes cho đầu ra đã chuẩn hóa và 512 KiB cho thumbnail. Ví dụ ảnh đầu vào 1 MiB với cấu hình mặc định giữ chỗ 6,5 MiB trong lúc xử lý.

Đây là dung lượng giữ chỗ tạm, không phải ảnh 1 MiB bị ghi tăng thành 6,5 MiB. Chặng xử lý ảnh phải thực thi đúng giới hạn đầu ra, xóa bản tạm và chuyển/release reservation nguyên tử theo số byte lưu thực tế. Không tự giảm reservation chỉ vì client báo đã upload xong.

Kiểm tra MIME/đuôi ở đây chỉ là kiểm tra metadata khai báo; chưa chứng minh nội dung tệp hợp lệ hoặc an toàn. Chặng nhận byte sẽ nhận dạng/quét/giải mã thực tế.

## Thêm handler vào GlobalExceptionHandler

Thêm bên trong class hiện có tại D:/event_chat/backend/src/main/java/com/eventchat/common/exception/GlobalExceptionHandler.java:

```java
@ExceptionHandler(AttachmentConflictException.class)
public ResponseEntity<ApiResponse<Void>> handleAttachmentConflict(
        AttachmentConflictException ex) {
    return ResponseEntity.status(409).body(ApiResponse.error(ex.getMessage()));
}

@ExceptionHandler(UnsupportedAttachmentTypeException.class)
public ResponseEntity<ApiResponse<Void>> handleUnsupportedAttachmentType(
        UnsupportedAttachmentTypeException ex) {
    return ResponseEntity.status(415).body(ApiResponse.error(ex.getMessage()));
}
```

AttachmentQuotaExceededException kế thừa AttachmentConflictException nên được xử lý 409 cùng nhóm. Handler UploadTooLargeException 413 đã có, giữ lại. SecurityException dùng handler 403 hiện có.

## Bạn thực hiện theo thứ tự

1. Tạo ba exception trong common.exception.
2. Tạo UploadMetadata trong package model, sau đó interface AttachmentService và AttachmentServiceImpl.
3. Kiểm tra imports: Transactional thuộc org.springframework.transaction.annotation; RoomStatus thuộc modules.room.enums.
4. Thêm hai handler vào GlobalExceptionHandler.
5. Compile backend. Không tự bỏ @Transactional hoặc @Lock để vượt lỗi test.
6. Gửi check service để kiểm tra code bạn viết trước khi tạo controller/rate limit.

## Những trường hợp cần test

- Request hợp lệ tạo RESERVED và tăng reservedBytes đúng một lần.
- Retry giống payload trả cùng publicId, quota không đổi; thay size/name/type với cùng client ID bị từ chối.
- Phòng đóng/hết hạn hoặc session bị thu hồi không tạo intent.
- Kích thước vượt giới hạn ảnh/file và loại/đuôi không thuộc allowlist bị từ chối.
- Intent đang upload đã hết hạn không được gia hạn bằng retry.
- Hai request cùng phòng tranh dung lượng cuối: chỉ phần vừa quota được nhận.
- Lỗi ghi attachment không được giữ lại reservation đã rollback.

## Giới hạn của chặng này

Chưa có controller nên chưa dùng Postman để upload thật. Chưa có rate limit upload riêng, global disk quota, cancel/status hoặc cleanup intent hết hạn. Các phần này phải làm trước khi bật upload hoàn chỉnh; không coi createIntent là toàn bộ tính năng.

Bước sau: controller POST /api/v1/rooms/{slug}/attachments với @Valid + X-Session-Token và policy UPLOAD_INTENT trong token bucket. Sau đó mới đến PUT content.

## Kiểm chứng mã hướng dẫn

Project thử artifacts/upload-service-lesson-check đã compile cùng entity/DTO/repository và qua 9 test service trên H2. Bản source thực tế có AttachmentServiceImplTest (15 ca gồm tham số hóa) và AttachmentErrorContractTest (4 ca), đều qua: retry không cộng quota/gia hạn deadline, payload khác, session revoked/sai phòng, phòng đóng/hết hạn, loại/dung lượng sai, intent hết hạn cả trạng thái UPLOADING, giữ chỗ xử lý ảnh, rollback khi save lỗi và hai request đồng thời tranh quota. Chưa chạy race này trên MySQL hoặc qua HTTP/proxy. Không ghi dữ liệu vào database local của người dùng trong lượt hoàn thiện service. Bộ test backend: 309 ca, 0 failure, 0 error, 7 skipped.

