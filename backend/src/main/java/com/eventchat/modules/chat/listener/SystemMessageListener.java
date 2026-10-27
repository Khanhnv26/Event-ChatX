package com.eventchat.modules.chat.listener;

import com.eventchat.common.event.MemberJoinedEvent;
import com.eventchat.common.event.RoomClosedEvent;
import com.eventchat.modules.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class SystemMessageListener {

    private final ChatService chatService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMemberJoined(MemberJoinedEvent event) {
        chatService.postSystemMessage(
                event.getRoomId(),
                event.getSlug(),
                event.getRoomExpiresAt(),
                event.getNickname() + " đã tham gia phòng",
                Map.of("event", "MEMBER_JOINED", "guestId", event.getGuestId(), "nickname", event.getNickname())
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRoomClosed(RoomClosedEvent event) {
        chatService.postSystemMessage(
                event.getRoomId(),
                event.getSlug(),
                event.getRoomExpiresAt(),
                "Phòng chat đã đóng",
                Map.of("event", "ROOM_CLOSED")
        );
    }
}
