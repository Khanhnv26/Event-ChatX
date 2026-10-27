package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomCacheService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RoomCloseServiceTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final RoomCacheService cache = mock(RoomCacheService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final RoomServiceImpl service = new RoomServiceImpl(rooms, sessions, cache, events);

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t\n"})
    void missingTokenDoesNotAcquireTheRoomLock(String token) {
        assertThrows(SecurityException.class, () -> service.closeRoom("room", token));
        verifyNoInteractions(rooms, sessions, cache, events);
    }

    @ParameterizedTest
    @ValueSource(strings = {"participant-token", "another-room-host"})
    void invalidTokenCannotCloseEvenAnAlreadyClosedRoom(String token) {
        Room room = setup(RoomStatus.CLOSED, false);
        assertThrows(SecurityException.class, () -> service.closeRoom("room", token));
        assertEquals(RoomStatus.CLOSED, room.getRoomStatus());
        verify(rooms, never()).save(any());
        verifyNoInteractions(cache, events);
    }

    @ParameterizedTest
    @CsvSource({"CREATED,false", "EXPIRED,false", "ACTIVE,true"})
    void inactiveOrExpiredRoomCannotBeClosed(RoomStatus status, boolean expired) {
        Room room = setup(status, expired);
        assertThrows(IllegalArgumentException.class, () -> service.closeRoom("room", "host"));
        assertEquals(status, room.getRoomStatus());
        assertNull(room.getClosedAt());
        verify(rooms, never()).save(any());
        verifyNoInteractions(cache, events);
    }

    @Test
    void repeatingClosePreservesTheOriginalTimestampWithoutSideEffects() {
        Room room = setup(RoomStatus.CLOSED, false);
        Instant original = Instant.parse("2026-10-20T00:00:00Z");
        room.setClosedAt(original);
        assertDoesNotThrow(() -> service.closeRoom("room", "host"));
        assertEquals(original, room.getClosedAt());
        verify(rooms, never()).save(any());
        verifyNoInteractions(cache, events);
    }

    private Room setup(RoomStatus status, boolean expired) {
        Room room = Room.builder().slug("room").roomStatus(status)
                .hostTokenHash(TokenUtil.sha256("host"))
                .expiresAt(Instant.now().plusSeconds(expired ? -60 : 3600)).build();
        room.setId(1L);
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        return room;
    }
}
