package com.eventchat.infrastructure.websocket;

import com.eventchat.common.event.RoomMembershipChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.context.event.EventListener;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class RoomMembershipListener {
    private final RealtimeSessionRegistry registry;
    private final SimpMessagingTemplate broker;

    @EventListener
    public void connected(SessionConnectedEvent event) {
        if (event.getUser() instanceof RealtimeSessionRegistry.Identity identity) {
            presenceChanged(identity.slug());
        }
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) {
        // DISCONNECT can arrive before the underlying transport finishes closing.
        // Remove Redis presence before notifying observers.
        registry.remove(event.getSessionId());
        if (event.getUser() instanceof RealtimeSessionRegistry.Identity identity) {
            presenceChanged(identity.slug());
        }
    }

    private void presenceChanged(String slug) {
        try { broker.convertAndSend("/topic/room." + slug + ".events", Map.of("type", "PRESENCE_CHANGED")); }
        catch (RuntimeException ignored) { /* Clients also poll to recover missed notifications. */ }
    }

    @TransactionalEventListener
    public void changed(RoomMembershipChangedEvent event) {
        if (event.type().equals("MEMBER_KICKED")) registry.revoke(event.slug(), event.guestId());
        try { broker.convertAndSend("/topic/room." + event.slug() + ".events", event); }
        catch (RuntimeException ignored) { /* Clients reconcile state after reconnect. */ }
    }
}
