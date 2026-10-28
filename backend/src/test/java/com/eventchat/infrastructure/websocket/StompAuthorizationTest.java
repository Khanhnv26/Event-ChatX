package com.eventchat.infrastructure.websocket;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.entity.*;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.*;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StompAuthorizationTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final RealtimeSessionRegistry registry = new RealtimeSessionRegistry(sessions, mock(RoomPresenceService.class));
    private final StompAuthorizationInterceptor guard = new StompAuthorizationInterceptor(rooms, sessions, registry);
    private final MessageChannel channel = mock(MessageChannel.class);

    @BeforeEach void setup() {
        var room = Room.builder().slug("room").build(); room.setId(1L);
        var session = RoomSession.builder().room(room).guestId("guest").build(); session.setId(2L);
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("token")))
                .thenReturn(Optional.of(session));
        when(sessions.existsByIdAndRoomIdAndRevokedAtIsNull(2L, 1L)).thenReturn(true);
    }
    private Message<byte[]> frame(StompCommand command, String destination) {
        var accessor = StompHeaderAccessor.create(command);
        accessor.setSessionId("socket");
        if (destination != null) accessor.setDestination(destination);
        if (command == StompCommand.CONNECT) {
            accessor.setNativeHeader("X-Room-Slug", "room");
            accessor.setNativeHeader("X-Session-Token", "token");
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
    private void connect() { guard.preSend(frame(StompCommand.CONNECT, null), channel); }

    @Test void connectBindsServerIdentityAndRemovesCredentialsBeforeBroker() {
        var message = frame(StompCommand.CONNECT, null);
        assertSame(message, guard.preSend(message, channel));
        assertEquals("1:2", registry.identity("socket").getName());
        var headers = StompHeaderAccessor.wrap(message);
        assertNull(headers.getFirstNativeHeader("X-Session-Token"));
        assertEquals("1:2", headers.getUser().getName());
    }
    @Test void missingTokenCannotConnect() {
        var accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("socket"); accessor.setLeaveMutable(true);
        assertThrows(SecurityException.class, () -> guard.preSend(MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders()), channel));
        assertNull(registry.identity("socket"));
    }
    @Test void revokedOrWrongRoomTokenCannotConnect() {
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("token"))).thenReturn(Optional.empty());
        assertThrows(SecurityException.class, this::connect);
        assertNull(registry.identity("socket"));
    }
    @ParameterizedTest
    @ValueSource(strings={"messages", "polls", "decisions", "wheels", "wheels.*.spins", "events"})
    void allowsOnlyTheAuthenticatedRoomTopics(String suffix) {
        connect();
        assertNotNull(guard.preSend(frame(StompCommand.SUBSCRIBE, "/topic/room.room." + suffix), channel));
    }
    @ParameterizedTest
    @ValueSource(strings={"/topic/room.other.messages", "/topic/room.*.messages", "/queue/private", "/topic/room.room.#", "/app/chat"})
    void rejectsCrossRoomWildcardsAndOtherDestinations(String destination) {
        connect();
        assertThrows(SecurityException.class, () -> guard.preSend(frame(StompCommand.SUBSCRIBE, destination), channel));
    }
    @ParameterizedTest
    @ValueSource(strings={"/topic/room.room.messages", "/app/chat", "/queue/test"})
    void rejectsAllClientWritesIncludingSpoofedBroadcasts(String destination) {
        connect();
        assertThrows(SecurityException.class, () -> guard.preSend(frame(StompCommand.SEND, destination), channel));
    }
    @Test void subscribeRequiresConnectFirst() {
        assertThrows(SecurityException.class, () -> guard.preSend(frame(StompCommand.SUBSCRIBE, "/topic/room.room.messages"), channel));
    }
    @Test void revokedSocketCannotReceiveAlreadySubscribedBroadcastsAndIsClosed() throws Exception {
        var socket = mock(WebSocketSession.class); when(socket.getId()).thenReturn("socket");
        registry.track(socket); connect();
        when(sessions.existsByIdAndRoomIdAndRevokedAtIsNull(2L, 1L)).thenReturn(false);
        var accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        accessor.setSessionId("socket");
        var message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        assertNull(new StompOutboundGuard(registry).beforeHandle(message, channel, mock(MessageHandler.class)));
        verify(socket).close(CloseStatus.POLICY_VIOLATION);
        assertNull(registry.identity("socket"));
    }
    @Test void scheduledRevalidationClosesIdleSocketRevokedOnAnotherInstance() throws Exception {
        var socket = mock(WebSocketSession.class); when(socket.getId()).thenReturn("socket");
        registry.track(socket); connect();
        when(sessions.existsByIdAndRoomIdAndRevokedAtIsNull(2L, 1L)).thenReturn(false);
        registry.revalidate(); verify(socket).close(CloseStatus.POLICY_VIOLATION);
    }
    @Test void sqlFailureFailsClosedForOutboundDelivery() {
        connect();
        when(sessions.existsByIdAndRoomIdAndRevokedAtIsNull(2L, 1L)).thenThrow(new IllegalStateException("offline"));
        assertFalse(registry.valid("socket"));
    }
}
