package com.eventchat.modules.export.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.service.DecisionService;
import com.eventchat.modules.export.dto.response.RoomExportResponse;
import com.eventchat.modules.export.service.ExportService;
import com.eventchat.modules.interaction.poll.dto.response.PollOptionResponse;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.enums.PollType;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.interaction.wheel.dto.response.WheelResponse;
import com.eventchat.modules.interaction.wheel.dto.response.WheelSpinResponse;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExportServiceImpl implements ExportService {

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final DecisionService decisionService;
    private final PollService pollService;
    private final WheelService wheelService;

    @Override
    @Transactional(readOnly = true)
    public RoomExportResponse exportRoomSummary(String slug, String rawHostToken) {

        if(rawHostToken == null || rawHostToken.isBlank()) {
            throw new SecurityException("Không có quyền truy cập vào phòng này");
        }

        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String suppliedTokenHash = TokenUtil.sha256(rawHostToken);

        if(!suppliedTokenHash.equals(room.getHostTokenHash())) {
            throw new SecurityException("Bạn không có quyền Host để xuất báo cáo phòng này");
        }


        int participantCount = roomSessionRepository.findAllByRoomId(room.getId()).size();

        List<DecisionResponse> confirmedDecisions = decisionService.getDecisionsByRoom(slug)
                .stream()
                .filter(decision -> decision.getStatus() == DecisionStatus.CONFIRMED)
                .toList();

        List<PollResponse> polls = pollService.getPollsByRoom(slug);
        List<WheelResponse> wheels = wheelService.getWheelsByRoom(slug);
        Instant exportedAt = Instant.now();

        String markdownSummary = buildMarkdown(room, participantCount, confirmedDecisions, polls, wheels, exportedAt);

        return RoomExportResponse.builder()
                .roomSlug(room.getSlug())
                .roomTitle(room.getTitle())
                .roomStatus(room.getRoomStatus())
                .participantCount(participantCount)
                .confirmedDecisions(confirmedDecisions)
                .polls(polls)
                .wheels(wheels)
                .markdownSummary(markdownSummary)
                .exportedAt(exportedAt)
                .build();
    }

    private String buildMarkdown(
            Room room,
            int participantCount,
            List<DecisionResponse> confirmedDecisions,
            List<PollResponse> polls,
            List<WheelResponse> wheels,
            Instant exportedAt) {

        StringBuilder sb = new StringBuilder();
        sb.append("# BIÊN BẢN TÓM TẮT PHÒNG SỰ KIỆN: ").append(room.getTitle()).append("\n\n");
        sb.append("- **Mã phòng:** `").append(room.getSlug()).append("`\n");
        sb.append("- **Trạng thái:** ").append(room.getRoomStatus()).append("\n");
        sb.append("- **Số thành viên tham gia:** ").append(participantCount).append("\n");
        sb.append("- **Thời điểm xuất báo cáo:** ").append(exportedAt).append("\n\n");

        sb.append("## 1. Các quyết định đã chốt (Confirmed Decisions)\n");
        if (confirmedDecisions.isEmpty()) {
            sb.append("_Chưa có quyết định nào được chốt._\n\n");
        } else {
            for (int i = 0; i < confirmedDecisions.size(); i++) {
                DecisionResponse d = confirmedDecisions.get(i);
                sb.append(i + 1).append(". **").append(d.getText()).append("**\n");
                sb.append("   - Người đề xuất: ").append(d.getCreatorNickname() != null ? d.getCreatorNickname() : "Ẩn danh").append("\n");
                sb.append("   - Người chốt: ").append(d.getConfirmedByNickname() != null ? d.getConfirmedByNickname() : "Chưa ghi nhận").append("\n");
                sb.append("   - Thời điểm chốt: ").append(d.getConfirmedAt() != null ? d.getConfirmedAt() : "Chưa ghi nhận").append("\n");
                sb.append("   - Đồng thuận: ").append(d.getApproveCount()).append(" tán thành / ")
                        .append(d.getRejectCount()).append(" phản đối\n");
                if (d.getEvidenceRefs() != null && !d.getEvidenceRefs().isEmpty()) {
                    List<String> sources = d.getEvidenceRefs().stream()
                            .map(ref -> ref.replaceFirst("^poll:(\\d+)$", "Bình chọn #$1")).toList();
                    sb.append("   - Căn cứ: ").append(String.join(", ", sources)).append("\n");
                }
            }
            sb.append("\n");
        }

        sb.append("## 2. Kết quả bình chọn \n");
        if (polls.isEmpty()) {
            sb.append("_Không có cuộc bình chọn nào._\n\n");
        } else {
            for (PollResponse poll : polls) {
                sb.append("### ").append(poll.getQuestion()).append(" (").append(poll.getStatus()).append(")\n");
                if (poll.getStatus() == PollStatus.OPEN) {
                    sb.append("_Kết quả tạm thời, bình chọn còn mở._\n");
                }
                appendPollResults(sb, poll);
                sb.append("\n");
            }
        }

        sb.append("## 3. Kết quả vòng quay \n");
        if (wheels.isEmpty()) {
            sb.append("_Không có vòng quay nào._\n");
        } else {
            for (WheelResponse wheel : wheels) {
                sb.append("### ").append(wheel.getTitle()).append("\n");
                if (wheel.getSpins() == null || wheel.getSpins().isEmpty()) {
                    sb.append("- _Chưa có lượt quay nào._\n");
                } else {
                    for (WheelSpinResponse spin : wheel.getSpins()) {
                        sb.append("- Người quay: **").append(spin.getActorNickname())
                                .append("** -> Kết quả trúng: **").append(spin.getResultEntry()).append("**\n");
                    }
                }
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private void appendPollResults(StringBuilder summary, PollResponse poll) {
        List<PollOptionResponse> options = poll.getOptions() == null ? List.of() : poll.getOptions();
        if (poll.getType() == PollType.RANKING) {
            List<PollOptionResponse> ranked = options.stream()
                    .sorted(Comparator.comparingInt(PollOptionResponse::getRankingScore).reversed()).toList();
            int topScore = ranked.isEmpty() ? 0 : ranked.getFirst().getRankingScore();
            if (topScore > 0) {
                List<String> leaders = ranked.stream().filter(option -> option.getRankingScore() == topScore)
                        .map(PollOptionResponse::getLabel).toList();
                summary.append(leaders.size() > 1 ? "**Đồng dẫn đầu:** " : "**Dẫn đầu:** ")
                        .append(String.join(", ", leaders)).append(" · ").append(topScore).append(" điểm\n");
            }
            for (PollOptionResponse option : ranked) {
                summary.append("- ").append(option.getLabel()).append(": **").append(option.getRankingScore())
                        .append(" điểm** · ").append(option.getVoteCount()).append(" lượt xếp\n");
            }
            return;
        }
        if (poll.getType() == PollType.RATING) {
            long votes = 0;
            long stars = 0;
            for (int index = 0; index < options.size(); index++) {
                PollOptionResponse option = options.get(index);
                int value = (option.getDisplayOrder() == null ? index : option.getDisplayOrder()) + 1;
                votes += option.getVoteCount();
                stars += (long) value * option.getVoteCount();
            }
            if (votes > 0) {
                String average = BigDecimal.valueOf(stars).divide(BigDecimal.valueOf(votes), 1, RoundingMode.HALF_UP)
                        .stripTrailingZeros().toPlainString().replace('.', ',');
                summary.append("**").append(average).append("/5 sao** · ").append(votes).append(" lượt đánh giá\n");
            } else {
                summary.append("_Chưa có đánh giá._\n");
            }
        }
        for (PollOptionResponse option : options) {
            summary.append("- ").append(option.getLabel()).append(": **").append(option.getVoteCount()).append(" phiếu**\n");
        }
    }
}
