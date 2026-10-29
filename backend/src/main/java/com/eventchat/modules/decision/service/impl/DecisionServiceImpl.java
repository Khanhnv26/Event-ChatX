package com.eventchat.modules.decision.service.impl;

import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.decision.dto.request.ConfirmDecisionRequest;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.dto.request.UpdateDecisionStatusRequest;
import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.entity.DecisionConfirmation;
import com.eventchat.modules.decision.enums.ConfirmationChoice;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.repository.DecisionConfirmationRepository;
import com.eventchat.modules.decision.repository.DecisionRepository;
import com.eventchat.modules.decision.service.DecisionService;
import com.eventchat.modules.interaction.wheel.repository.WheelSpinRepository;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.enums.SessionRole;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DecisionServiceImpl implements DecisionService {

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final DecisionRepository decisionRepository;
    private final DecisionConfirmationRepository decisionConfirmationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;
    private final WheelSpinRepository wheelSpinRepository;

    @Override
    @Transactional
    public DecisionResponse createDecision(String slug, String rawSessionToken, CreateDecisionRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        requireWritable(room);

        List<String> evidence = new ArrayList<>(request.getEvidenceRefs() != null ? request.getEvidenceRefs() : List.of());
        if (evidence.stream().anyMatch(ref -> ref == null || ref.startsWith("wheel-spin:"))) {
            throw new IllegalArgumentException("Tham chiếu lượt quay phải được gửi qua sourceSpinId");
        }
        String text = request.getText().trim();
        if (request.getSourceSpinId() != null) {
            if (session.getRole() != SessionRole.HOST) throw new SecurityException("Chỉ Host được lưu kết quả vòng quay");
            var spin = wheelSpinRepository.findById(request.getSourceSpinId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lượt quay"));
            if (!spin.getRoom().getId().equals(room.getId())) throw new IllegalArgumentException("Lượt quay không thuộc phòng này");
            String ref = "wheel-spin:" + spin.getId();
            var saved = decisionRepository.findAllByRoomIdOrderByCreatedAtDesc(room.getId()).stream()
                    .filter(d -> fromJson(d.getEvidenceRefs()).contains(ref)).findFirst();
            if (saved.isPresent()) return mapToResponse(saved.get());
            text = text + " → " + spin.getResultEntry();
            evidence = new ArrayList<>(List.of("Kết quả từ Vòng quay", ref));
        }

        Decision decision = Decision.builder()
                .room(room)
                .createdBy(session)
                .text(text)
                .status(request.isProposeImmediately() ? DecisionStatus.PROPOSED : DecisionStatus.DRAFT)
                .evidenceRefs(toJson(evidence))
                .build();

        decisionRepository.save(decision);

        DecisionResponse response = mapToResponse(decision);
        broadcastAfterCommit(slug, response);
        return response;
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DecisionResponse confirmDecision(String slug, Long decisionId, String rawSessionToken, ConfirmDecisionRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        requireWritable(room);

        Decision decision = decisionRepository.findByIdAndRoomIdForUpdate(decisionId, room.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy quyết định với ID: " + decisionId));

        requireWritable(room);
        if (decision.getStatus() != DecisionStatus.PROPOSED) {
            throw new IllegalArgumentException("Chỉ có thể bỏ phiếu khi quyết định đang ở trạng thái đề xuất");
        }

        DecisionConfirmation confirmation = decisionConfirmationRepository
                .findByDecisionIdAndSessionId(decisionId, session.getId())
                .orElseGet(() -> DecisionConfirmation.builder()
                        .decision(decision)
                        .session(session)
                        .build());

        confirmation.setChoice(request.getChoice());
        decisionConfirmationRepository.save(confirmation);

        DecisionResponse response = mapToResponse(decision);
        broadcastAfterCommit(slug, response);
        return response;
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DecisionResponse updateDecisionStatus(String slug, Long decisionId, String rawHostToken, UpdateDecisionStatusRequest request) {
        return updateDecisionStatus(slug, decisionId, rawHostToken, null, request);
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DecisionResponse updateDecisionStatus(String slug, Long decisionId, String rawHostToken, String rawSessionToken, UpdateDecisionStatusRequest request) {
        if (rawHostToken == null || rawHostToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu host token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        if (!TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Chỉ Host mới có quyền thay đổi trạng thái quyết định");
        }

        requireWritable(room);

        RoomSession confirmer = null;
        if (rawSessionToken != null) {
            confirmer = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(rawSessionToken))
                    .orElseThrow(() -> new SecurityException("Phiên người chốt không hợp lệ"));
            if (confirmer.getRole() != SessionRole.HOST) {
                throw new SecurityException("Phiên người chốt phải là Host của phòng");
            }
        }

        Decision decision = decisionRepository.findByIdAndRoomIdForUpdate(decisionId, room.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy quyết định với ID: " + decisionId));

        requireWritable(room);

        DecisionStatus nextStatus = request.getStatus();
        requireValidTransition(decision.getStatus(), nextStatus);
        decision.setStatus(nextStatus);

        if (nextStatus == DecisionStatus.CONFIRMED) {
            decision.setConfirmedAt(Instant.now());
            decision.setConfirmedByGuestId(confirmer != null ? confirmer.getGuestId() : null);
            decision.setConfirmedByNickname(confirmer != null ? confirmer.getNickname() : null);
        }

        decisionRepository.save(decision);

        DecisionResponse response = mapToResponse(decision);
        broadcastAfterCommit(slug, response);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<DecisionResponse> getDecisionsByRoom(String slug) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        return decisionRepository.findAllByRoomIdOrderByCreatedAtDesc(room.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DecisionResponse removeDecision(String slug, Long decisionId, String rawSessionToken) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) throw new IllegalArgumentException("Thiếu session token");
        Room room = roomRepository.findBySlugForUpdate(slug).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng"));
        requireWritable(room);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(
                room.getId(), TokenUtil.sha256(rawSessionToken)).orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));
        Decision decision = decisionRepository.findByIdAndRoomIdForUpdate(decisionId, room.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy quyết định"));
        requireWritable(room);
        boolean host = session.getRole() == SessionRole.HOST;
        boolean owner = decision.getCreatedBy() != null && decision.getCreatedBy().getId().equals(session.getId());
        if (!host && (!owner || decision.getStatus() == DecisionStatus.CONFIRMED || decision.getStatus() == DecisionStatus.WITHDRAWN)) {
            throw new SecurityException("Bạn không có quyền xóa hoặc thu hồi quyết định này");
        }
        if (decision.getStatus() == DecisionStatus.DELETED || decision.getStatus() == DecisionStatus.WITHDRAWN) return mapToResponse(decision);
        decision.setStatus(decision.getStatus() == DecisionStatus.CONFIRMED ? DecisionStatus.WITHDRAWN : DecisionStatus.DELETED);
        decisionRepository.save(decision);
        var response = mapToResponse(decision);
        broadcastAfterCommit(slug, response);
        return response;
    }

    private DecisionResponse mapToResponse(Decision decision) {
        long approveCount = decisionConfirmationRepository.countByDecisionIdAndChoice(decision.getId(), ConfirmationChoice.APPROVE);
        long rejectCount = decisionConfirmationRepository.countByDecisionIdAndChoice(decision.getId(), ConfirmationChoice.REJECT);
        return DecisionResponse.builder()
                .id(decision.getId())
                .creatorNickname(decision.getCreatedBy() != null ? decision.getCreatedBy().getNickname() : null)
                .creatorGuestId(decision.getCreatedBy() != null ? decision.getCreatedBy().getGuestId() : null)
                .text(decision.getText())
                .status(decision.getStatus())
                .evidenceRefs(fromJson(decision.getEvidenceRefs()))
                .approveCount(approveCount)
                .rejectCount(rejectCount)
                .createdAt(decision.getCreatedAt())
                .confirmedAt(decision.getConfirmedAt())
                .confirmedByGuestId(decision.getConfirmedByGuestId())
                .confirmedByNickname(decision.getConfirmedByNickname())
                .build();
    }

    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Lỗi chuyển danh sách sang JSON", e);
        }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(json, new TypeReference<List<String>>() {}));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Lỗi đọc danh sách từ JSON", e);
        }
    }

    private void requireWritable(Room room) {
        if (room.getRoomStatus() != RoomStatus.ACTIVE) {
            throw new IllegalArgumentException("Phòng đã đóng hoặc không còn hoạt động");

        }

        if(!Instant.now().isBefore(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng đã hết hạn");
        }
    }

    private void broadcastAfterCommit(String slug, DecisionResponse response) {
        RealtimeEventPublisher.afterCommit(messagingTemplate, "/topic/room." + slug + ".decisions", response);
    }

    private void requireValidTransition(DecisionStatus currentStatus, DecisionStatus nextStatus) {
        if(nextStatus == null) {
            throw new IllegalArgumentException("Trang thái mới không được để trống");
        }

        boolean allowed = switch (currentStatus) {
            case DRAFT -> nextStatus == DecisionStatus.PROPOSED;
            case PROPOSED -> nextStatus == DecisionStatus.CONFIRMED || nextStatus == DecisionStatus.REJECTED;
            case CONFIRMED, REJECTED, DELETED, WITHDRAWN -> false;
        };

        if(!allowed) {
            throw new IllegalArgumentException("Không thể chuyển trạng thái từ " + currentStatus + " sang " + nextStatus);
        }
    }

}
