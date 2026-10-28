package com.eventchat.modules.room.controller;

import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoomCapacityContractTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final RoomServiceImpl service = new RoomServiceImpl(rooms, sessions, mock(RoomCacheService.class), events);
    private MockMvc mvc;
    private Room room;

    @BeforeEach
    void setup() {
        room = Room.builder().slug("room").title("Capacity test").expiresAt(Instant.now().plusSeconds(3600)).build();
        room.setId(1L);
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        mvc = MockMvcBuilders.standaloneSetup(new RoomController(service, org.mockito.Mockito.mock(com.eventchat.modules.room.service.RoomAccessService.class)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper().findAndRegisterModules()))
                .build();
    }

    @ParameterizedTest
    @ValueSource(longs = {50, 51})
    void fullOrAlreadyOverCapacityRoomReturns409WithoutSavingOrPublishing(long count) throws Exception {
        when(sessions.countByRoomIdAndRevokedAtIsNull(1L)).thenReturn(count);
        mvc.perform(post("/api/v1/rooms/room/join").contentType("application/json").content("{\"nickname\":\"Guest\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.success").value(false));
        verify(sessions, never()).save(any());
        verifyNoInteractions(events);
    }

    @Test
    void lastAvailableSlotCanBeFilled() throws Exception {
        when(sessions.countByRoomIdAndRevokedAtIsNull(1L)).thenReturn(49L);
        mvc.perform(post("/api/v1/rooms/room/join").contentType("application/json").content("{\"nickname\":\"Guest\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("PARTICIPANT"));
        verify(sessions).save(any());
        verify(events).publishEvent(any(Object.class));
    }

    @Test
    void detailsExposeTheDefaultRoomCapacity() throws Exception {
        when(sessions.findAllByRoomIdAndRevokedAtIsNull(1L)).thenReturn(List.of());
        assertEquals(50, room.getMaxParticipants());
        mvc.perform(get("/api/v1/rooms/room")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maxParticipants").value(50));
    }
}
