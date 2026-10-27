package com.eventchat.modules.chat.service.impl;

import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.entity.Message;
import com.eventchat.modules.chat.entity.SenderInfo;
import com.eventchat.modules.chat.repository.MessageRepository;
import com.eventchat.modules.chat.service.SequenceGenerator;
import com.eventchat.modules.room.cache.RoomSnapshot;
import com.eventchat.modules.room.cache.SessionSnapshot;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.service.RoomCacheService;
import com.eventchat.modules.room.service.SessionCacheService;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatServiceImplTest {
    private final MessageRepository messages = mock(MessageRepository.class);
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final SequenceGenerator sequence = mock(SequenceGenerator.class);
    private final RoomCacheService rooms = mock(RoomCacheService.class);
    private final SessionCacheService sessions = mock(SessionCacheService.class);
    private final ChatServiceImpl service = new ChatServiceImpl(messages, broker, sequence, rooms, sessions);

    @Test
    void concurrentRetryReturnsAlreadyCommittedMessage() {
        RoomSnapshot room = RoomSnapshot.builder().id(1L).status(RoomStatus.ACTIVE)
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        when(rooms.getBySlug("room")).thenReturn(room);
        when(sessions.getByToken(eq("room"), eq(1L), anyString()))
                .thenReturn(SessionSnapshot.builder().sessionId(2L).guestId("guest").nickname("Name").build());
        Message committed = Message.builder().id("server-id").roomId(1L).clientMessageId("client-id")
                .sender(SenderInfo.builder().sessionId(2L).guestId("guest").build()).sequence(1L).build();
        when(messages.findByRoomIdAndClientMessageId(1L, "client-id"))
                .thenReturn(Optional.empty(), Optional.of(committed));
        when(messages.save(any())).thenThrow(new DuplicateKeyException("duplicate client message"));
        var result = assertDoesNotThrow(() -> service.sendMessage("room", "token",
                SendMessageRequest.builder().clientMessageId("client-id").body("Hello").build()));
        assertEquals("server-id", result.getId());
        verifyNoInteractions(broker);
    }

    @Test
    void sequenceZeroUsesCatchupQueryRatherThanLatestFiftyMessages() {
        when(rooms.getBySlug("room")).thenReturn(RoomSnapshot.builder().id(1L).build());
        service.getMessages("room", 0L);
        verify(messages).findByRoomIdAndSequenceGreaterThanOrderBySequenceAsc(eq(1L), eq(0L), any());
        verify(messages, never()).findByRoomIdOrderBySequenceDesc(anyLong(), any());
    }
}
