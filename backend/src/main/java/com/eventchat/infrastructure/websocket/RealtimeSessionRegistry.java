package com.eventchat.infrastructure.websocket;

import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class RealtimeSessionRegistry {
    public record Identity(String slug, Long roomId, Long sessionId, String guestId) implements Principal {
        @Override public String getName() { return roomId + ":" + sessionId; }
    }
    private final RoomSessionRepository sessions;
    private final RoomPresenceService presence;
    private final Map<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
    private final Map<String, Identity> identities = new ConcurrentHashMap<>();

    public void track(WebSocketSession socket) { sockets.put(socket.getId(), socket); }
    public void bind(String socketId, Identity identity) {
        identities.put(socketId, identity);
        presence.touch(socketId, identity);
    }
    public Identity identity(String socketId) { return socketId == null ? null : identities.get(socketId); }
    public void remove(String socketId) {
        sockets.remove(socketId);
        Identity identity = identities.remove(socketId);
        if (identity != null) presence.remove(socketId, identity);
    }

    public boolean valid(String socketId) {
        Identity identity = identity(socketId);
        if (identity == null) return false;
        try {
            return sessions.existsByIdAndRoomIdAndRevokedAtIsNull(identity.sessionId(), identity.roomId());
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    public void close(String socketId) {
        WebSocketSession socket = sockets.get(socketId);
        remove(socketId);
        if (socket != null) {
            try { socket.close(CloseStatus.POLICY_VIOLATION); }
            catch (Exception ignored) { }
        }
    }

    public void revoke(String slug, String guestId) {
        identities.forEach((id, identity) -> {
            if (identity.slug().equals(slug) && identity.guestId().equals(guestId)) close(id);
        });
    }

    // Also detects revocations committed by another backend instance, even on idle sockets.
    @Scheduled(fixedDelayString = "${app.websocket.revalidation-ms:5000}")
    public void revalidate() {
        identities.forEach((id, identity) -> {
            if (!valid(id)) close(id);
            else presence.touch(id, identity);
        });
    }
}
