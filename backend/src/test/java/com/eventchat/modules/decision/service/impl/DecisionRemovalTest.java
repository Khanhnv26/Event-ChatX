package com.eventchat.modules.decision.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.repository.*;
import com.eventchat.modules.interaction.wheel.entity.WheelSpin;
import com.eventchat.modules.interaction.wheel.repository.WheelSpinRepository;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.*;
import com.eventchat.modules.room.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class DecisionRemovalTest {
    final RoomRepository rooms = mock(RoomRepository.class);
    final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    final DecisionRepository decisions = mock(DecisionRepository.class);
    final WheelSpinRepository spins = mock(WheelSpinRepository.class);
    final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    final DecisionServiceImpl service = new DecisionServiceImpl(rooms, sessions, decisions,
            mock(DecisionConfirmationRepository.class), broker, new ObjectMapper(), spins);
    Room room;
    RoomSession owner, host, other;
    Decision decision;

    @BeforeEach void setup() {
        room = Room.builder().slug("room").expiresAt(Instant.now().plusSeconds(3600)).build(); room.setId(1L);
        owner = RoomSession.builder().room(room).role(SessionRole.PARTICIPANT).guestId("owner").build(); owner.setId(2L);
        host = RoomSession.builder().room(room).role(SessionRole.HOST).guestId("host").build(); host.setId(3L);
        other = RoomSession.builder().room(room).role(SessionRole.PARTICIPANT).build(); other.setId(4L);
        for (var entry : Map.of("owner", owner, "host", host, "other", other).entrySet())
            when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256(entry.getKey()))).thenReturn(Optional.of(entry.getValue()));
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        decision = Decision.builder().room(room).createdBy(owner).text("Dinner").status(DecisionStatus.PROPOSED).evidenceRefs("[]").build(); decision.setId(10L);
        when(decisions.findByIdAndRoomIdForUpdate(10L, 1L)).thenReturn(Optional.of(decision));
        when(decisions.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test void authorCanDeleteProposalButOtherGuestsCannot() {
        assertThrows(SecurityException.class, () -> service.removeDecision("room", 10L, "other"));
        assertEquals(DecisionStatus.PROPOSED, decision.getStatus());
        assertEquals(DecisionStatus.DELETED, service.removeDecision("room", 10L, "owner").getStatus());
        assertEquals("Dinner", decision.getText());
    }
    @Test void onlyHostCanWithdrawConfirmedDecisionAndHistoryIsRetained() {
        decision.setStatus(DecisionStatus.CONFIRMED); decision.setConfirmedAt(Instant.now());
        assertThrows(SecurityException.class, () -> service.removeDecision("room", 10L, "owner"));
        assertEquals(DecisionStatus.WITHDRAWN, service.removeDecision("room", 10L, "host").getStatus());
        assertNotNull(decision.getConfirmedAt());
        assertEquals(DecisionStatus.WITHDRAWN, service.removeDecision("room", 10L, "host").getStatus());
        verify(decisions, times(1)).save(any());
    }
    @Test void removalRejectsRevokedSessionsAndClosedRooms() {
        assertThrows(SecurityException.class, () -> service.removeDecision("room", 10L, "revoked"));
        room.setRoomStatus(RoomStatus.CLOSED);
        assertThrows(IllegalArgumentException.class, () -> service.removeDecision("room", 10L, "host"));
        verify(decisions, never()).save(any());
    }
    @Test void savingTheSameSpinAgainReturnsTheExistingDecisionEvenAfterRemoval() {
        WheelSpin spin = WheelSpin.builder().room(room).resultEntry("Host").build(); spin.setId(7L);
        when(spins.findById(7L)).thenReturn(Optional.of(spin));
        var request = CreateDecisionRequest.builder().text("Người bao kèo lẩu").sourceSpinId(7L).build();
        var created = service.createDecision("room", "host", request);
        assertEquals("Người bao kèo lẩu → Host", created.getText());
        assertEquals(List.of("Kết quả từ Vòng quay", "wheel-spin:7"), created.getEvidenceRefs());
        Decision saved = Decision.builder().room(room).createdBy(host).text(created.getText())
                .status(DecisionStatus.DELETED).evidenceRefs("[\"Kết quả từ Vòng quay\",\"wheel-spin:7\"]").build(); saved.setId(11L);
        when(decisions.findAllByRoomIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(saved));
        assertEquals(11L, service.createDecision("room", "host", request).getId());
        verify(decisions, times(1)).save(any());
    }
    @Test void foreignRoomSpinsAndParticipantsCannotCreateWheelDecisions() {
        Room foreign = Room.builder().build(); foreign.setId(99L);
        WheelSpin spin = WheelSpin.builder().room(foreign).resultEntry("Host").build(); spin.setId(7L);
        when(spins.findById(7L)).thenReturn(Optional.of(spin));
        var request = CreateDecisionRequest.builder().text("Dinner").sourceSpinId(7L).build();
        assertThrows(SecurityException.class, () -> service.createDecision("room", "owner", request));
        assertThrows(IllegalArgumentException.class, () -> service.createDecision("room", "host", request));
        verify(decisions, never()).save(any());
    }
}
