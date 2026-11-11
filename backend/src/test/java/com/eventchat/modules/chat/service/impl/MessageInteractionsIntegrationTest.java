package com.eventchat.modules.chat.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.chat.dto.response.MessageInteractionsResponse;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.dto.response.ReactionResponse;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.chat.enums.ReactionEmoji;
import com.eventchat.modules.chat.service.ChatService;
import com.eventchat.modules.chat.service.MessageInteractionService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.SessionRole;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.impl.RoomAccessImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import({MessageInteractionServiceImpl.class, RoomAccessImpl.class})
class MessageInteractionsIntegrationTest {
    @Autowired private MessageInteractionService interactions;
    @Autowired private RoomRepository rooms;
    @Autowired private RoomSessionRepository sessions;
    @MockBean private ChatService chat;
    @MockBean private SimpMessagingTemplate broker;
    private Long roomId;

    @BeforeEach
    void setUp() {
        Room room = rooms.save(Room.builder().slug("living-tools").title("Living Tools")
                .hostTokenHash(TokenUtil.sha256("host")).expiresAt(Instant.now().plusSeconds(3600)).build());
        roomId = room.getId();
        sessions.save(RoomSession.builder().room(room).guestId("one").nickname("One")
                .role(SessionRole.HOST).sessionTokenHash(TokenUtil.sha256("one")).build());
        sessions.save(RoomSession.builder().room(room).guestId("two").nickname("Two")
                .role(SessionRole.PARTICIPANT).sessionTokenHash(TokenUtil.sha256("two")).build());
        when(chat.findPublishedMessage(roomId, "first")).thenReturn(Optional.of(
                MessageResponse.builder().id("first").messageType(MessageType.TEXT).body("Agenda").build()));
        when(chat.findPublishedMessage(roomId, "second")).thenReturn(Optional.of(
                MessageResponse.builder().id("second").messageType(MessageType.TEXT).body("New agenda").build()));
    }

    @Test
    void reactionsAreIdempotentAndReadSeparatelyForEachSession() {
        interactions.setReaction("living-tools", "one", "first", ReactionEmoji.HEART, true);
        interactions.setReaction("living-tools", "one", "first", ReactionEmoji.HEART, true);
        interactions.setReaction("living-tools", "two", "first", ReactionEmoji.HEART, true);
        assertEquals(2, reaction("one").getCount());
        assertTrue(reaction("two").isReactedByMe());

        interactions.setReaction("living-tools", "two", "first", ReactionEmoji.HEART, false);
        interactions.setReaction("living-tools", "two", "first", ReactionEmoji.HEART, false);
        assertEquals(1, reaction("two").getCount());
        assertFalse(reaction("two").isReactedByMe());
        assertTrue(reaction("one").isReactedByMe());
        assertThrows(IllegalArgumentException.class,
                () -> interactions.setReaction("living-tools", "one", "foreign", ReactionEmoji.HEART, true));
    }

    @Test
    void hostCanReplaceAndClearOnePinAndReadItWithoutHistory() {
        assertThrows(SecurityException.class, () -> interactions.pin("living-tools", "two", "first"));
        assertThrows(IllegalArgumentException.class, () -> interactions.pin("living-tools", "host", "foreign"));
        interactions.pin("living-tools", "host", "first");
        interactions.pin("living-tools", "host", "second");
        MessageInteractionsResponse snapshot = interactions.getInteractions("living-tools", "two", List.of());
        assertEquals("second", snapshot.getPinnedMessage().getId());
        assertTrue(snapshot.getReactions().isEmpty());
        interactions.unpin("living-tools", "host");
        interactions.unpin("living-tools", "host");
        assertNull(interactions.getInteractions("living-tools", "one", List.of()).getPinnedMessage());
    }

    @Test
    void pinBroadcastIncludesTheDestinationOfAThreadReply() {
        when(chat.findPublishedMessage(roomId, "reply")).thenReturn(Optional.of(MessageResponse.builder()
                .id("reply").threadRootId("first").sequence(42L).messageType(MessageType.TEXT).build()));

        interactions.pin("living-tools", "host", "reply");

        verifyNoInteractions(broker);
        TransactionSynchronizationManager.getSynchronizations().getLast().afterCommit();
        verify(broker).convertAndSend(eq("/topic/room.living-tools.events"), argThat((Object payload) ->
                payload instanceof Map<?, ?> event && "MESSAGE_PIN_CHANGED".equals(event.get("type"))
                        && "reply".equals(event.get("messageId")) && "first".equals(event.get("threadRootId"))
                        && Long.valueOf(42L).equals(event.get("sequence"))
                        && event.get("eventId") instanceof String eventId && !eventId.isBlank()));
    }

    private ReactionResponse reaction(String sessionToken) {
        return interactions.getInteractions("living-tools", sessionToken, List.of("first"))
                .getReactions().get("first").getFirst();
    }
}
