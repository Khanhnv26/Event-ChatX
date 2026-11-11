package com.eventchat.modules.export.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.service.DecisionService;
import com.eventchat.modules.interaction.poll.dto.response.PollOptionResponse;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.interaction.poll.enums.PollType;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExportServiceImplTest {
    private static final String SLUG = "room-a";
    private static final String HOST_TOKEN = "host-token-a";
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final DecisionService decisions = mock(DecisionService.class);
    private final PollService polls = mock(PollService.class);
    private final WheelService wheels = mock(WheelService.class);
    private final ExportServiceImpl service = new ExportServiceImpl(rooms, sessions, decisions, polls, wheels);

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t\n"})
    void missingOrBlankTokenCannotReadReportData(String token) {
        assertThrows(SecurityException.class, () -> service.exportRoomSummary(SLUG, token));
        verifyNoInteractions(rooms, sessions, decisions, polls, wheels);
    }

    @ParameterizedTest
    @ValueSource(strings = {"wrong-token", "host-token-b", "participant-session-token"})
    void tokenThatIsNotTheRequestedRoomsHostCannotReadReportData(String token) {
        setupRoom(RoomStatus.ACTIVE);
        assertThrows(SecurityException.class, () -> service.exportRoomSummary(SLUG, token));
        verifyNoInteractions(sessions, decisions, polls, wheels);
    }

    @ParameterizedTest
    @EnumSource(value = RoomStatus.class, names = {"ACTIVE", "CLOSED"})
    void hostCanExportAndOnlyConfirmedDecisionsAreIncluded(RoomStatus status) {
        setupRoom(status);
        var confirmed = DecisionResponse.builder().id(10L).text("Approved choice")
                .creatorNickname("Author").confirmedByNickname("Lan")
                .status(DecisionStatus.CONFIRMED).build();
        var proposed = DecisionResponse.builder().id(11L).text("Unapproved proposal")
                .status(DecisionStatus.PROPOSED).build();
        var draft = DecisionResponse.builder().id(12L).text("Private draft")
                .status(DecisionStatus.DRAFT).build();
        when(sessions.findAllByRoomId(1L)).thenReturn(List.of());
        when(decisions.getDecisionsByRoom(SLUG)).thenReturn(List.of(confirmed, proposed, draft));
        when(polls.getPollsByRoom(SLUG)).thenReturn(List.of());
        when(wheels.getWheelsByRoom(SLUG)).thenReturn(List.of());

        var response = service.exportRoomSummary(SLUG, HOST_TOKEN);

        assertEquals(SLUG, response.getRoomSlug());
        assertEquals(status, response.getRoomStatus());
        assertEquals(List.of(confirmed), response.getConfirmedDecisions());
        assertNotNull(response.getExportedAt());
        assertTrue(response.getMarkdownSummary().contains("Approved choice"));
        assertTrue(response.getMarkdownSummary().contains("Người đề xuất: Author"));
        assertTrue(response.getMarkdownSummary().contains("Người chốt: Lan"));
        assertTrue(response.getMarkdownSummary().contains("Thời điểm chốt: Chưa ghi nhận"));
        assertFalse(response.getMarkdownSummary().contains("Unapproved proposal"));
        assertFalse(response.getMarkdownSummary().contains("Private draft"));
        verify(polls).getPollsByRoom(SLUG);
        verify(wheels).getWheelsByRoom(SLUG);
    }

    @Test
    void exportsWeightedRatingsAndRankingTiesByPoints() {
        setupRoom(RoomStatus.CLOSED);
        PollResponse rating = PollResponse.builder().question("Đánh giá").type(PollType.RATING)
                .status(PollStatus.CLOSED).options(List.of(
                        PollOptionResponse.builder().label("1 sao").displayOrder(0).voteCount(1).build(),
                        PollOptionResponse.builder().label("5 sao").displayOrder(4).voteCount(2).build())).build();
        PollResponse ranking = PollResponse.builder().question("Ưu tiên").type(PollType.RANKING)
                .status(PollStatus.CLOSED).options(List.of(
                        PollOptionResponse.builder().label("C").voteCount(4).rankingScore(4).build(),
                        PollOptionResponse.builder().label("A").voteCount(2).rankingScore(6).build(),
                        PollOptionResponse.builder().label("B").voteCount(3).rankingScore(6).build())).build();
        when(polls.getPollsByRoom(SLUG)).thenReturn(List.of(rating, ranking));

        String markdown = service.exportRoomSummary(SLUG, HOST_TOKEN).getMarkdownSummary();

        assertTrue(markdown.contains("**3,7/5 sao** · 3 lượt đánh giá"));
        assertTrue(markdown.contains("**Đồng dẫn đầu:** A, B · 6 điểm"));
        assertTrue(markdown.contains("- A: **6 điểm** · 2 lượt xếp\n- B: **6 điểm** · 3 lượt xếp\n- C: **4 điểm**"));
    }

    @Test
    void nonexistentRoomDoesNotReadReportData() {
        when(rooms.findBySlug(SLUG)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.exportRoomSummary(SLUG, HOST_TOKEN));
        verifyNoInteractions(sessions, decisions, polls, wheels);
    }

    private void setupRoom(RoomStatus status) {
        Room room = Room.builder().slug(SLUG).title("Test room").roomStatus(status)
                .hostTokenHash(TokenUtil.sha256(HOST_TOKEN)).build();
        room.setId(1L);
        when(rooms.findBySlug(SLUG)).thenReturn(Optional.of(room));
    }
}
