package com.eventchat.infrastructure.websocket;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class StompAuthorizationInterceptor implements ChannelInterceptor {
    private final RoomRepository rooms;
    private final RoomSessionRepository sessions;
    private final RealtimeSessionRegistry registry;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor headers = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (headers == null || headers.getCommand() == null) return message;
        String socketId = headers.getSessionId();
        if (socketId == null) throw new SecurityException("Thiếu WebSocket session");
        StompCommand command = headers.getCommand();
        if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
            if (registry.identity(socketId) != null) throw new SecurityException("Đã xác thực kết nối");
            String slug = headers.getFirstNativeHeader("X-Room-Slug");
            String token = headers.getFirstNativeHeader("X-Session-Token");
            headers.removeNativeHeader("X-Session-Token");
            if (slug == null || token == null || token.isBlank()) throw new SecurityException("Thiếu thông tin xác thực");
            var room = rooms.findBySlug(slug).orElseThrow(() -> new SecurityException("Không có quyền truy cập phòng"));
            var session = sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(token))
                    .orElseThrow(() -> new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ"));
            var identity = new RealtimeSessionRegistry.Identity(slug, room.getId(), session.getId(), session.getGuestId());
            registry.bind(socketId, identity);
            headers.setUser(identity);
            // Credentials are never forwarded to the broker.
            return message;
        }
        if (command == StompCommand.DISCONNECT) return message;
        var identity = registry.identity(socketId);
        if (identity == null || !registry.valid(socketId)) {
            registry.close(socketId);
            throw new SecurityException("Phiên đã bị thu hồi hoặc không hợp lệ");
        }
        if (command == StompCommand.SUBSCRIBE) {
            String prefix = "/topic/room." + identity.slug();
            Set<String> allowed = Set.of(prefix + ".messages", prefix + ".polls", prefix + ".decisions",
                    prefix + ".wheels", prefix + ".wheels.*.spins", prefix + ".events");
            if (!allowed.contains(headers.getDestination())) throw new SecurityException("Không được đăng ký topic này");
        } else if (command != StompCommand.UNSUBSCRIBE) {
            // All writes use authenticated, rate-limited REST endpoints.
            throw new SecurityException("Không được gửi dữ liệu bằng STOMP");
        }
        return message;
    }
}
