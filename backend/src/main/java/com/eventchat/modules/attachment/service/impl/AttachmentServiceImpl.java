package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentQuotaExceededException;
import com.eventchat.common.exception.UnsupportedAttachmentTypeException;
import com.eventchat.common.exception.UploadTooLargeException;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.infrastructure.storage.config.StorageProperties;
import com.eventchat.modules.attachment.config.AttachmentProperties;
import com.eventchat.modules.attachment.dto.request.CreateUploadIntentRequest;
import com.eventchat.modules.attachment.dto.response.UploadIntentResponse;
import com.eventchat.modules.attachment.entity.Attachment;
import com.eventchat.modules.attachment.entity.RoomAttachmentQuota;
import com.eventchat.modules.attachment.enums.AttachmentState;
import com.eventchat.modules.attachment.model.UploadMetadata;
import com.eventchat.modules.attachment.repository.AttachmentRepository;
import com.eventchat.modules.attachment.repository.RoomAttachmentQuotaRepository;
import com.eventchat.modules.attachment.service.AttachmentService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
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
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {

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
    public UploadIntentResponse createIntent(String slug, String rawSessionToken, CreateUploadIntentRequest request) {

        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new SecurityException("Thiếu phiên tham gia phòng");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));

        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(rawSessionToken))
                .orElseThrow(() -> new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ"));

        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        validateRoomWritable(room, now);

        UploadMetadata metadata = normalizeMetadata(request);

        Optional<Attachment> existingAttachment = attachmentRepository.findByRoom_IdAndUploaderSessionIdAndClientUploadId(room.getId(), session.getId(), request.getClientUploadId());
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
        long limit = image
                ? attachmentProperties.getImageMaxBytes()
                : attachmentProperties.getFileMaxBytes();
        if (request.getSizeBytes() > limit) {
            throw new UploadTooLargeException(limit);
        }

        long reservationBytes = request.getSizeBytes();
        if (image) {
            long processingBudget = Math.addExact(
                    attachmentProperties.getImageMaxBytes(), THUMBNAIL_BUDGET_BYTES);
            reservationBytes = Math.addExact(reservationBytes, processingBudget);
        }

        Optional<RoomAttachmentQuota> existingQuota =
                roomAttachmentQuotaRepository.findForUpdate(room.getId());
        RoomAttachmentQuota quota;
        if (existingQuota.isPresent()) {
            quota = existingQuota.get();
        } else {
            quota = new RoomAttachmentQuota();
            quota.setRoomId(room.getId());
            quota = roomAttachmentQuotaRepository.saveAndFlush(quota);
        }

        long roomLimit = attachmentProperties.getRoomQuotaBytes();
        long storedBytes = quota.getStoredBytes();
        long reservedBytes = quota.getReservedBytes();
        if (storedBytes < 0 || reservedBytes < 0) {
            throw new IllegalStateException("Quota không hợp lệ");
        }
        if (storedBytes > roomLimit || reservedBytes > roomLimit - storedBytes
                || reservationBytes > roomLimit - storedBytes - reservedBytes) {
            throw new AttachmentQuotaExceededException();
        }

        now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        validateRoomWritable(room, now);
        long intentSeconds = Math.min(attachmentProperties.getIntentTtlSeconds(),
                Duration.between(now, room.getExpiresAt()).getSeconds());
        if (intentSeconds <= 0) {
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
                .reservedBytes(reservationBytes)
                .chargedBytes(0)
                .state(AttachmentState.RESERVED)
                .uploadExpiresAt(now.plusSeconds(intentSeconds))
                .expiresAt(room.getExpiresAt().plus(Duration.ofDays(7)))
                .build();

        quota.setReservedBytes(reservedBytes + reservationBytes);
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

        return UploadMetadata.builder()
                .filename(filename)
                .contentType(contentType)
                .extension(extension)
                .build();
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
            throw new AttachmentConflictException("Intent không còn hợp lệ");
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
