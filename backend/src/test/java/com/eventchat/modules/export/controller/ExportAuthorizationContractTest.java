package com.eventchat.modules.export.controller;

import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.decision.service.DecisionService;
import com.eventchat.modules.export.service.impl.ExportServiceImpl;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ExportAuthorizationContractTest {
    private static final String HOST_TOKEN = "host-token-a";
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final DecisionService decisions = mock(DecisionService.class);
    private final PollService polls = mock(PollService.class);
    private final WheelService wheels = mock(WheelService.class);
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        Room room = Room.builder().slug("room-a").title("Phòng thử nghiệm").roomStatus(RoomStatus.CLOSED)
                .hostTokenHash(TokenUtil.sha256(HOST_TOKEN)).build();
        room.setId(1L);
        when(rooms.findBySlug("room-a")).thenReturn(Optional.of(room));
        var service = new ExportServiceImpl(rooms, sessions, decisions, polls, wheels);
        mvc = MockMvcBuilders.standaloneSetup(new ExportController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new ByteArrayHttpMessageConverter(),
                        new MappingJackson2HttpMessageConverter(new ObjectMapper().findAndRegisterModules()))
                .build();
    }

    static Stream<org.junit.jupiter.params.provider.Arguments> forbiddenRequests() {
        return Stream.of("/api/v1/rooms/room-a/export", "/api/v1/rooms/room-a/export/markdown")
                .flatMap(path -> Stream.of(null, "", "   ", "wrong-token", "host-token-b", "participant-token")
                        .map(token -> org.junit.jupiter.params.provider.Arguments.of(path, token)));
    }

    @ParameterizedTest
    @MethodSource("forbiddenRequests")
    void bothFormatsRejectUnauthorizedRequestsWith403(String path, String token) throws Exception {
        var request = get(path);
        if (token != null) request.header("X-Host-Token", token);
        mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(sessions, decisions, polls, wheels);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/rooms/room-a/export", "/api/v1/rooms/room-a/export/markdown"})
    void bothFormatsAllowTheCorrectHostOfAClosedRoom(String path) throws Exception {
        when(sessions.findAllByRoomId(1L)).thenReturn(List.of());
        when(decisions.getDecisionsByRoom("room-a")).thenReturn(List.of());
        when(polls.getPollsByRoom("room-a")).thenReturn(List.of());
        when(wheels.getWheelsByRoom("room-a")).thenReturn(List.of());
        var result = mvc.perform(get(path).header("X-Host-Token", HOST_TOKEN))
                .andExpect(status().isOk()).andReturn().getResponse();

        if (path.endsWith("/markdown")) {
            assertTrue(result.getContentType().startsWith("text/markdown"));
            assertEquals("attachment; filename=\"eventchat-summary-room-a.md\"",
                    result.getHeader("Content-Disposition"));
            assertTrue(result.getContentAsString(StandardCharsets.UTF_8).contains("Phòng thử nghiệm"));
        } else {
            var body = new ObjectMapper().readTree(result.getContentAsByteArray());
            assertTrue(body.get("success").asBoolean());
            assertEquals("room-a", body.at("/data/roomSlug").asText());
        }
    }
}
