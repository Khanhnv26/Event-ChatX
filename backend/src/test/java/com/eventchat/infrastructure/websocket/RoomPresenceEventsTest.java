package com.eventchat.infrastructure.websocket;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import java.util.Map;
import static org.mockito.Mockito.*;

class RoomPresenceEventsTest {
    private final RealtimeSessionRegistry registry = mock(RealtimeSessionRegistry.class);
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final RoomMembershipListener listener = new RoomMembershipListener(registry, broker);
    private final RealtimeSessionRegistry.Identity identity =
            new RealtimeSessionRegistry.Identity("room", 1L, 2L, "guest");

    @Test
    void connectedNotifiesExistingRoomObservers() {
        listener.connected(new SessionConnectedEvent(this, MessageBuilder.withPayload(new byte[0]).build(), identity));
        verify(broker).convertAndSend("/topic/room.room.events", Map.of("type", "PRESENCE_CHANGED"));
    }

    @Test
    void disconnectRemovesPresenceBeforeObserversRefresh() {
        listener.disconnected(new SessionDisconnectEvent(this, MessageBuilder.withPayload(new byte[0]).build(),
                "socket", CloseStatus.NORMAL, identity));
        var order = inOrder(registry, broker);
        order.verify(registry).remove("socket");
        order.verify(broker).convertAndSend("/topic/room.room.events", Map.of("type", "PRESENCE_CHANGED"));
    }
}
