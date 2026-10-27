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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomExpiryContractTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final RoomServiceImpl service = new RoomServiceImpl(rooms, sessions, mock(RoomCacheService.class), mock(ApplicationEventPublisher.class));
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        when(rooms.save(any())).thenAnswer(call -> {
            Room room = call.getArgument(0);
            room.setId(1L);
            return room;
        });
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        mvc = MockMvcBuilders.standaloneSetup(new RoomController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 30, 90, 10080})
    void createsRoomsUsingMinutePrecision(int minutes) throws Exception {
        verifyDuration("\"ttlMinutes\":" + minutes, minutes);
    }

    @ParameterizedTest
    @CsvSource({"1,60", "24,1440", "168,10080"})
    void acceptsLegacyHours(int hours, int minutes) throws Exception {
        verifyDuration("\"ttlHours\":" + hours, minutes);
    }

    @Test
    void missingDurationDefaultsToTwentyFourHours() throws Exception {
        verifyDuration("", 1440);
    }

    @Test
    void activeButExpiredRoomRejectsJoiningBeforeTheScheduledJobRuns() throws Exception {
        Room room = Room.builder().slug("expired").expiresAt(Instant.now().minusSeconds(1)).build();
        when(rooms.findBySlug("expired")).thenReturn(Optional.of(room));
        when(rooms.findBySlugForUpdate("expired")).thenReturn(Optional.of(room));
        mvc.perform(post("/api/v1/rooms/expired/join").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"Late guest\"}")).andExpect(status().isBadRequest());
        verify(sessions, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"ttlMinutes\":0", "\"ttlMinutes\":4", "\"ttlMinutes\":-1",
            "\"ttlMinutes\":10081", "\"ttlMinutes\":5.5", "\"ttlMinutes\":\"\"",
            "\"ttlHours\":0", "\"ttlHours\":169", "\"ttlHours\":1.5",
            "\"ttlMinutes\":5,\"ttlHours\":1"})
    void rejectsInvalidAndAmbiguousDurations(String fields) throws Exception {
        mvc.perform(post("/api/v1/rooms").contentType(MediaType.APPLICATION_JSON).content(body(fields)))
                .andExpect(status().isBadRequest());
        verify(rooms, never()).save(any());
        verify(sessions, never()).save(any());
    }

    private void verifyDuration(String fields, int minutes) throws Exception {
        Instant before = Instant.now().plus(minutes, ChronoUnit.MINUTES);
        mvc.perform(post("/api/v1/rooms").contentType(MediaType.APPLICATION_JSON).content(body(fields)))
                .andExpect(status().isOk());
        Instant after = Instant.now().plus(minutes, ChronoUnit.MINUTES);
        ArgumentCaptor<Room> saved = ArgumentCaptor.forClass(Room.class);
        verify(rooms).save(saved.capture());
        assertFalse(saved.getValue().getExpiresAt().isBefore(before));
        assertFalse(saved.getValue().getExpiresAt().isAfter(after));
    }

    private String body(String fields) {
        return "{\"title\":\"Test room\",\"hostNickname\":\"Host\"" + (fields.isEmpty() ? "" : "," + fields) + "}";
    }
}
