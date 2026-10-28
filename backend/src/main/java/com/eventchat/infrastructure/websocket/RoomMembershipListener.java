package com.eventchat.infrastructure.websocket;

import com.eventchat.common.event.RoomMembershipChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class RoomMembershipListener {
    private final RealtimeSessionRegistry registry;
    private final SimpMessagingTemplate broker;

    @TransactionalEventListener
    public void changed(RoomMembershipChangedEvent event) {
        if (event.type().equals("MEMBER_KICKED")) registry.revoke(event.slug(), event.guestId());
        try { broker.convertAndSend("/topic/room." + event.slug() + ".events", event); }
        catch (RuntimeException ignored) { /* Clients reconcile state after reconnect. */ }
    }
}
