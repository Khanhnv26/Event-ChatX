package com.eventchat.modules.room.controller;

import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.*;
import com.eventchat.modules.room.service.RoomService;
import com.eventchat.modules.room.service.impl.RoomAccessImpl;
import com.eventchat.modules.chat.controller.ChatController;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.interaction.poll.controller.PollController;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.interaction.wheel.controller.WheelController;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.decision.controller.DecisionController;
import com.eventchat.modules.decision.service.DecisionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;
import java.util.stream.Stream;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoomReadAuthorizationTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final RoomService roomService = mock(RoomService.class);
    private final ChatService chat = mock(ChatService.class);
    private final PollService polls = mock(PollService.class);
    private final WheelService wheels = mock(WheelService.class);
    private final DecisionService decisions = mock(DecisionService.class);
    private MockMvc mvc;
    private Room room;
    private static final String[] PATHS = {"/api/v1/rooms/room", "/api/v1/rooms/room/messages",
            "/api/v1/rooms/room/polls", "/api/v1/rooms/room/wheels",
            "/api/v1/rooms/room/wheels/1/spins", "/api/v1/rooms/room/decisions"};

    @BeforeEach
    void setup() {
        room = Room.builder().slug("room").build();
        room.setId(1L);
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        var access = new RoomAccessImpl(rooms, sessions);
        mvc = MockMvcBuilders.standaloneSetup(new RoomController(roomService, access),
                new ChatController(chat, access), new PollController(polls, access),
                new WheelController(wheels, access), new DecisionController(decisions, access))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    static Stream<Arguments> denied() {
        return Stream.of(PATHS).flatMap(path -> Stream.of("missing", "wrong", "other-room", "revoked")
                .map(token -> Arguments.of(path, token)));
    }

    @ParameterizedTest
    @MethodSource("denied")
    void missingInvalidWrongRoomOrRevokedSessionCannotRead(String path, String token) throws Exception {
        var request = get(path);
        if (!token.equals("missing")) request.header("X-Session-Token", token);
        mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(roomService, chat, polls, wheels, decisions);
        if (token.equals("missing")) verifyNoInteractions(rooms, sessions);
        else verify(sessions).findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256(token));
    }

    static Stream<Arguments> allowed() {
        return Stream.of(PATHS).flatMap(path -> Stream.of(RoomStatus.ACTIVE, RoomStatus.CLOSED)
                .map(status -> Arguments.of(path, status)));
    }

    @ParameterizedTest
    @MethodSource("allowed")
    void activeSessionCanReadIncludingClosedRooms(String path, RoomStatus status) throws Exception {
        room.setRoomStatus(status);
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("valid")))
                .thenReturn(Optional.of(RoomSession.builder().room(room).build()));
        mvc.perform(get(path).header("X-Session-Token", "valid")).andExpect(status().isOk());
        switch (path) {
            case "/api/v1/rooms/room" -> verify(roomService).getRoomDetails("room");
            case "/api/v1/rooms/room/messages" -> verify(chat).getMessages("room", null);
            case "/api/v1/rooms/room/polls" -> verify(polls).getPollsByRoom("room", "valid");
            case "/api/v1/rooms/room/wheels" -> verify(wheels).getWheelsByRoom("room");
            case "/api/v1/rooms/room/wheels/1/spins" -> verify(wheels).getSpinsByWheel("room", 1L);
            case "/api/v1/rooms/room/decisions" -> verify(decisions).getDecisionsByRoom("room");
            default -> throw new AssertionError(path);
        }
    }
}
