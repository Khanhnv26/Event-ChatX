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
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
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

    @Override
    @Transactional
    public DecisionResponse createDecision(String slug, String rawSessionToken, CreateDecisionRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        requireWritable(room);

        Decision decision = Decision.builder()
                .room(room)
                .createdBy(session)
                .text(request.getText())
                .status(request.isProposeImmediately() ? DecisionStatus.PROPOSED : DecisionStatus.DRAFT)
                .evidenceRefs(toJson(request.getEvidenceRefs() != null ? request.getEvidenceRefs() : List.of()))
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
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
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
        if (rawHostToken == null || rawHostToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu host token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        if (!TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Chỉ Host mới có quyền thay đổi trạng thái quyết định");
        }

        requireWritable(room);

        Decision decision = decisionRepository.findByIdAndRoomIdForUpdate(decisionId, room.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy quyết định với ID: " + decisionId));

        requireWritable(room);

        DecisionStatus nextStatus = request.getStatus();
        requireValidTransition(decision.getStatus(), nextStatus);
        decision.setStatus(nextStatus);

        if (nextStatus == DecisionStatus.CONFIRMED) {
            decision.setConfirmedAt(Instant.now());
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

    private DecisionResponse mapToResponse(Decision decision) {
        long approveCount = decisionConfirmationRepository.countByDecisionIdAndChoice(decision.getId(), ConfirmationChoice.APPROVE);
        long rejectCount = decisionConfirmationRepository.countByDecisionIdAndChoice(decision.getId(), ConfirmationChoice.REJECT);
        return DecisionResponse.builder()
                .id(decision.getId())
                .creatorNickname(decision.getCreatedBy() != null ? decision.getCreatedBy().getNickname() : null)
                .text(decision.getText())
                .status(decision.getStatus())
                .evidenceRefs(fromJson(decision.getEvidenceRefs()))
                .approveCount(approveCount)
                .rejectCount(rejectCount)
                .createdAt(decision.getCreatedAt())
                .confirmedAt(decision.getConfirmedAt())
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
            case CONFIRMED, REJECTED -> false;
        };

        if(!allowed) {
            throw new IllegalArgumentException("Không thể chuyển trạng thái từ " + currentStatus + " sang " + nextStatus);
        }
    }

}
