package com.eventchat.modules.room.controller;

import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.room.service.impl.RoomServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoomJoinLockContractTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final RoomCacheService cache = mock(RoomCacheService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final RoomServiceImpl service = new RoomServiceImpl(rooms, sessions, cache, events);
    private MockMvc mvc;
    private Room room;

    @BeforeEach
    void setup() {
        room = Room.builder().slug("room").title("Join lock").hostTokenHash(TokenUtil.sha256("host"))
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        room.setId(1L);
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        mvc = MockMvcBuilders.standaloneSetup(new RoomController(service, org.mockito.Mockito.mock(com.eventchat.modules.room.service.RoomAccessService.class)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper().findAndRegisterModules()))
                .build();
    }

    @Test
    void hostCanLockAndUnlockAndDetailsReflectBothStates() throws Exception {
        for (boolean locked : new boolean[]{true, false}) {
            mvc.perform(patch("/api/v1/rooms/room/join-lock").header("X-Host-Token", "host")
                    .contentType("application/json").content("{\"joinLocked\":" + locked + "}"))
                    .andExpect(status().isOk());
            assertEquals(locked, room.isJoinLocked());
            mvc.perform(get("/api/v1/rooms/room")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.joinLocked").value(locked));
        }
        verify(rooms, times(2)).findBySlugForUpdate("room");
        verify(cache, times(2)).evict("room");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "wrong", "guest-session"})
    void invalidHostCannotChangeLock(String token) throws Exception {
        mvc.perform(patch("/api/v1/rooms/room/join-lock").header("X-Host-Token", token)
                .contentType("application/json").content("{\"joinLocked\":true}"))
                .andExpect(status().isForbidden());
        assertFalse(room.isJoinLocked());
        verify(rooms, never()).save(any());
        verifyNoInteractions(cache);
    }

    @Test
    void missingHostIsForbiddenBeforeDatabaseAccess() throws Exception {
        mvc.perform(patch("/api/v1/rooms/room/join-lock").contentType("application/json")
                .content("{\"joinLocked\":true}")).andExpect(status().isForbidden());
        verify(rooms, never()).findBySlugForUpdate(anyString());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"joinLocked\":null}", "{\"locked\":true}"})
    void missingOrNullStateIsRejected(String json) throws Exception {
        mvc.perform(patch("/api/v1/rooms/room/join-lock").header("X-Host-Token", "host")
                .contentType("application/json").content(json)).andExpect(status().isBadRequest());
        verify(rooms, never()).findBySlugForUpdate(anyString());
    }

    @Test
    void lockedJoinReturns409BeforeCountingSavingOrPublishing() throws Exception {
        room.setJoinLocked(true);
        mvc.perform(post("/api/v1/rooms/room/join").contentType("application/json")
                .content("{\"nickname\":\"Guest\"}")).andExpect(status().isConflict());
        verifyNoInteractions(sessions, events);
    }

    @Test
    void repeatedStateDoesNotSaveOrEvict() {
        service.updateJoinLock("room", "host", false);
        verify(rooms, never()).save(any());
        verifyNoInteractions(cache);
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREATED", "CLOSED", "EXPIRED", "TTL"})
    void inactiveOrExpiredRoomCannotChangeLock(String state) {
        if (state.equals("TTL")) room.setExpiresAt(Instant.now().minusSeconds(1));
        else room.setRoomStatus(RoomStatus.valueOf(state));
        assertThrows(IllegalArgumentException.class, () -> service.updateJoinLock("room", "host", true));
        verify(rooms, never()).save(any());
    }

    @Test
    void existingSessionCanReconnectWhileJoinLocked() {
        room.setJoinLocked(true);
        RoomSession session = RoomSession.builder().room(room).guestId("existing").nickname("Guest").build();
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("session")))
                .thenReturn(Optional.of(session));
        assertEquals("existing", service.reconnect("room", "session").getGuestId());
        verify(sessions).save(session);
        verify(sessions, never()).countByRoomId(anyLong());
    }
}
