package com.eventchat.modules.interaction.wheel.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.interaction.wheel.dto.request.SpinWheelRequest;
import com.eventchat.modules.interaction.wheel.entity.Wheel;
import com.eventchat.modules.interaction.wheel.repository.*;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.*;
import com.eventchat.modules.room.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WheelServiceImplTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final WheelRepository wheels = mock(WheelRepository.class);
    private final WheelSpinRepository spins = mock(WheelSpinRepository.class);
    private final WheelServiceImpl service = new WheelServiceImpl(rooms, sessions, wheels, spins,
            mock(SimpMessagingTemplate.class), new ObjectMapper());

    @Test
    void participantCannotSpinEvenWithAValidSession() {
        setup(RoomStatus.ACTIVE, SessionRole.PARTICIPANT);
        assertThrows(SecurityException.class, () -> spin());
        verify(spins, never()).save(any());
    }

    @Test
    void closedRoomRejectsHostSpin() {
        setup(RoomStatus.CLOSED, SessionRole.HOST);
        assertThrows(IllegalArgumentException.class, () -> spin());
        verify(spins, never()).save(any());
    }

    @Test
    void activeButExpiredRoomRejectsHostSpinBeforeTheJobRuns() {
        setup(RoomStatus.ACTIVE, SessionRole.HOST);
        rooms.findBySlug("room").orElseThrow().setExpiresAt(Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> spin());
        verify(spins, never()).save(any());
    }

    private void setup(RoomStatus status, SessionRole role) {
        Room room = Room.builder().slug("room").roomStatus(status).expiresAt(Instant.now().plusSeconds(3600)).build();
        room.setId(1L);
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        RoomSession session = RoomSession.builder().room(room).role(role).nickname("User").build();
        when(sessions.findByRoomIdAndSessionTokenHash(1L, TokenUtil.sha256("token"))).thenReturn(Optional.of(session));
        Wheel wheel = Wheel.builder().room(room).entries("[\"A\",\"B\"]").rules("KEEP_WINNER").build();
        wheel.setId(2L);
        when(wheels.findByIdForUpdate(2L)).thenReturn(Optional.of(wheel));
        when(spins.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private void spin() {
        service.spinWheel("room", 2L, "token", SpinWheelRequest.builder().idempotencyKey("key").build());
    }
}
