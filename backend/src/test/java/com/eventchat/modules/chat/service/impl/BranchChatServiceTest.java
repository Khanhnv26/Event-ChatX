package com.eventchat.modules.chat.service.impl;

import com.eventchat.modules.chat.dto.request.SendMessageRequest;
import com.eventchat.modules.chat.dto.MessageMention;
import com.eventchat.modules.chat.dto.response.MessageResponse;
import com.eventchat.modules.chat.entity.*;
import com.eventchat.modules.chat.enums.MessageType;
import com.eventchat.modules.chat.repository.*;
import com.eventchat.modules.chat.service.SequenceGenerator;
import com.eventchat.modules.room.cache.*;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.*;
import com.eventchat.modules.attachment.service.impl.AttachmentLinkService;
import com.eventchat.modules.attachment.dto.response.AttachmentResponse;
import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.event.AiPromptRequested;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BranchChatServiceTest {
    final MessageRepository messages = mock(MessageRepository.class);
    final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    final SequenceGenerator sequence = mock(SequenceGenerator.class);
    final RoomCacheService roomCache = mock(RoomCacheService.class);
    final SessionCacheService sessions = mock(SessionCacheService.class);
    final RoomRepository rooms = mock(RoomRepository.class);
    final AttachmentLinkService links = mock(AttachmentLinkService.class);
    final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    final RoomSessionRepository members = mock(RoomSessionRepository.class);
    final ChatServiceImpl service = new ChatServiceImpl(messages, broker, sequence, roomCache, sessions, rooms, links, events, members);
    Room room;
    Message root;

    @BeforeEach void setup() {
        room = Room.builder().roomStatus(RoomStatus.ACTIVE).expiresAt(Instant.now().plusSeconds(3600)).build(); room.setId(1L);
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        when(roomCache.getBySlug("room")).thenReturn(RoomSnapshot.builder().id(1L).build());
        when(sessions.getByToken(eq("room"), eq(1L), anyString())).thenReturn(SessionSnapshot.builder()
                .sessionId(2L).guestId("guest").nickname("Guest").build());
        root = Message.builder().id("root").roomId(1L).body("Topic").sequence(1L).build();
        when(messages.findById("root")).thenReturn(Optional.of(root));
        when(sequence.next(eq(1L), any())).thenReturn(2L);
        when(messages.save(any())).thenAnswer(call -> { Message message = call.getArgument(0); message.setId("reply"); return message; });
    }
    SendMessageRequest request() { return SendMessageRequest.builder().clientMessageId("client").body("Reply").threadRootId("root").build(); }

    @Test void sendsMentionsToTheSelectedMemberWithoutTreatingTheirNameAsAnAiCommand() {
        when(members.findAllByRoomIdAndRevokedAtIsNull(1L)).thenReturn(List.of(
                RoomSession.builder().guestId("first-ai").nickname("ai").build(),
                RoomSession.builder().guestId("second-ai").nickname("ai").build()));
        MessageMention mention = new MessageMention("second-ai", 0, 3, false);
        SendMessageRequest request = SendMessageRequest.builder().clientMessageId("client").threadRootId("root")
                .body("@ai xem giúp mình").mentions(List.of(mention)).build();

        MessageResponse response = service.sendMessage("room", "token", request);

        assertEquals(List.of(mention), response.getMentions());
        assertEquals("root", response.getThreadRootId());
        verify(broker).convertAndSend("/topic/room.room.messages", response);
        verifyNoInteractions(events);
    }

    @Test void rejectsMentionTargetsOutsideTheRoomAndRangesThatDoNotMatchTheName() {
        when(members.findAllByRoomIdAndRevokedAtIsNull(1L)).thenReturn(List.of(
                RoomSession.builder().guestId("member").nickname("Lan").build()));
        SendMessageRequest request = SendMessageRequest.builder().clientMessageId("client").threadRootId("root")
                .body("@Minh").mentions(List.of(new MessageMention("foreign", 0, 5, false))).build();
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request));
        request.setMentions(List.of(new MessageMention("member", 0, 5, false)));
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request));
        verify(messages, never()).save(any());
    }

    @Test void everyoneMentionRequiresTheGroupLabelAndHasNoIndividualRecipient() {
        MessageMention everyone = new MessageMention(null, 0, 9, true);
        SendMessageRequest request = SendMessageRequest.builder().clientMessageId("client").threadRootId("root")
                .body("@Everyone xem giúp").mentions(List.of(everyone)).build();

        assertEquals(List.of(everyone), service.sendMessage("room", "token", request).getMentions());
        verifyNoInteractions(members, events);
        request.setMentions(List.of(new MessageMention("member", 0, 9, true)));
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request));
    }

    @Test void directoryIncludesAnOldRootWithoutLoadingTheMainTimeline() {
        var time = Instant.parse("2026-10-29T07:00:00Z");
        when(messages.findThreadActivities(1L, Long.MAX_VALUE)).thenReturn(List.of(new ThreadActivity("root", 4L, 900L, time, "Latest reply")));
        when(messages.findByRoomIdAndIdIn(1L, List.of("root"))).thenReturn(List.of(root));
        var page = service.getThreads("room", null);
        assertEquals("root", page.getThreads().getFirst().getRootMessage().getId());
        assertEquals(4, page.getThreads().getFirst().getRootMessage().getThreadReplyCount());
        assertEquals(time, page.getThreads().getFirst().getLastActivityAt());
        assertEquals(900L, page.getNextActivitySequence());
        assertFalse(page.isHasMore());
        verify(messages, never()).findByRoomIdOrderBySequenceDesc(anyLong(), any());
    }

    @Test void directoryPaginatesScannedRootsAndSkipsMissingOrInvalidRoots() {
        var activities = new ArrayList<ThreadActivity>();
        for (int i = 0; i < 51; i++) activities.add(new ThreadActivity("root-" + i, 1L, 200L - i, Instant.now(), "Reply"));
        when(messages.findThreadActivities(1L, 201L)).thenReturn(activities);
        when(messages.findByRoomIdAndIdIn(eq(1L), anyList())).thenReturn(List.of(
                Message.builder().id("root-0").roomId(1L).body("Old root").build(),
                Message.builder().id("root-1").roomId(1L).messageType(MessageType.SYSTEM).build(),
                Message.builder().id("root-2").roomId(1L).threadRootId("nested").build()));
        var page = service.getThreads("room", 201L);
        assertEquals(1, page.getThreads().size());
        assertTrue(page.isHasMore());
        assertEquals(151L, page.getNextActivitySequence());
        assertThrows(IllegalArgumentException.class, () -> service.getThreads("room", 0L));
    }

    @Test void sendsReplyOnTheExistingRoomTopicWithItsThreadAndCount() {
        when(messages.countByRoomIdAndThreadRootId(1L, "root")).thenReturn(1L);
        var result = service.sendMessage("room", "token", request());
        assertEquals("root", result.getThreadRootId());
        assertEquals(1, result.getThreadReplyCount());
        verify(messages).save(argThat(message -> message.getThreadRootId().equals("root") && message.getRoomId().equals(1L)
                && message.getExpiresAt().equals(room.getExpiresAt().plusSeconds(604800))));
        verify(broker).convertAndSend(eq("/topic/room.room.messages"), eq(result));
    }
    @Test void retryReturnsOneSavedReplyAndRejectsChangingTheThreadOrBody() {
        var saved = Message.builder().id("reply").roomId(1L).threadRootId("root").body("Reply").sequence(2L)
                .sender(SenderInfo.builder().sessionId(2L).build()).build();
        when(messages.findByRoomIdAndClientMessageId(1L, "client")).thenReturn(Optional.of(saved));
        assertEquals("reply", service.sendMessage("room", "token", request()).getId());
        var changed = request(); changed.setBody("Other text");
        assertThrows(AttachmentConflictException.class, () -> service.sendMessage("room", "token", changed));
        changed.setThreadRootId(null);
        assertThrows(AttachmentConflictException.class, () -> service.sendMessage("room", "token", changed));
        verify(messages, never()).save(any());
    }
    @Test void rejectsForeignNestedAndSystemRootsBeforeSaving() {
        root.setRoomId(9L);
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request()));
        root.setRoomId(1L); root.setThreadRootId("other");
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request()));
        root.setThreadRootId(null); root.setMessageType(MessageType.SYSTEM);
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request()));
        verify(messages, never()).save(any());
    }
    @Test void rejectsCrossStreamQuotes() {
        var quote = request(); quote.setReplyToId("root");
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", quote));
        verify(messages, never()).save(any());
        verifyNoInteractions(links);
    }
    @Test void allowsBranchAttachmentsAndLinksThem() {
        var attached = request();
        var id = UUID.randomUUID().toString();
        attached.setAttachmentIds(List.of(id));
        var dummy = AttachmentResponse.builder().publicId(id).filename("doc.pdf").build();
        when(links.bind(eq(1L), any(), eq("client"), eq(List.of(id)), any())).thenReturn(List.of(dummy));

        var response = service.sendMessage("room", "token", attached);

        assertNotNull(response);
        assertEquals("root", response.getThreadRootId());
        assertEquals(1, response.getAttachments().size());
        assertEquals(id, response.getAttachments().get(0).getPublicId());
        verify(links).bind(eq(1L), any(), eq("client"), eq(List.of(id)), any());
    }
    @Test void closedAndExpiredRoomsRejectThreadWrites() {
        room.setRoomStatus(RoomStatus.CLOSED);
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request()));
        room.setRoomStatus(RoomStatus.ACTIVE); room.setExpiresAt(Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("room", "token", request()));
        verify(messages, never()).save(any());
    }
    @Test void readsTheRootEvenWhenItIsOutsideRecentMainHistoryAndPagesReplies() {
        var replies = java.util.stream.LongStream.rangeClosed(2, 102).mapToObj(n -> Message.builder()
                .id("reply-" + n).roomId(1L).threadRootId("root").sequence(n).build()).toList();
        when(messages.findByRoomIdAndThreadRootIdAndSequenceGreaterThanOrderBySequenceAsc(eq(1L), eq("root"), eq(0L), any())).thenReturn(replies);
        when(messages.countByRoomIdAndThreadRootId(1L, "root")).thenReturn(101L);
        var result = service.getThread("room", "root", 0L);
        assertEquals("root", result.getRootMessage().getId());
        assertEquals(101, result.getRootMessage().getThreadReplyCount());
        assertEquals(100, result.getMessages().size());
        assertTrue(result.isHasMore());
        assertEquals(101, result.getNextSequence());
    }
    @Test void mainHistoryEnrichesReplyCountsInOneBatch() {
        when(messages.findByRoomIdOrderBySequenceDesc(eq(1L), any())).thenReturn(List.of(root));
        when(messages.countThreadReplies(1L, List.of("root"))).thenReturn(List.of(new ThreadReplyCount("root", 3)));
        assertEquals(3, service.getMessages("room", null).getFirst().getThreadReplyCount());
        verify(messages, never()).countByRoomIdAndThreadRootId(anyLong(), anyString());
    }

    @Test void aiHistoryIncludesOnlyTheRootAndEarlierRepliesInTheSameBranch() {
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        var trigger = Message.builder().id("request").roomId(1L).threadRootId("root").sequence(10L)
                .sender(SenderInfo.builder().sessionId(2L).build()).build();
        when(messages.findById("request")).thenReturn(Optional.of(trigger));
        when(messages.findAiContext(1L, "root", 10L, PageRequest.of(0, 19))).thenReturn(List.of(
                Message.builder().id("newer").body("Mới hơn").build(),
                Message.builder().id("older").body("Cũ hơn").build()));
        var prompt = new AiPromptRequested("room", 1L, "request", 10L, "root", "guest", "hash", "Tóm tắt", true);

        assertEquals(List.of("root", "older", "newer"),
                service.getAiContext(prompt, 20).stream().map(line -> line.messageId()).toList());
        verify(messages, never()).findByRoomIdOrderBySequenceDesc(anyLong(), any());
    }

    @Test void retriedAiCommandEnqueuesOnlyOneRequest() {
        var command = request();
        command.setBody("/ai tóm tắt thảo luận");
        service.sendMessage("room", "token", command);
        when(messages.findByRoomIdAndClientMessageId(1L, "client")).thenReturn(Optional.of(
                Message.builder().id("reply").roomId(1L).threadRootId("root").body(command.getBody()).sequence(2L)
                        .sender(SenderInfo.builder().sessionId(2L).build()).build()));
        service.sendMessage("room", "token", command);

        verify(events).publishEvent(argThat((AiPromptRequested prompt) ->
                prompt.summary() && "root".equals(prompt.threadRootId())));
    }

    @Test void aiImageContextIncludesOnlyAttachedAndQuotedImagesInTheSameBranch() {
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        AttachmentResponse direct = AttachmentResponse.builder().publicId("direct").contentType("image/png").build();
        AttachmentResponse quoted = AttachmentResponse.builder().publicId("quoted").contentType("image/jpeg").build();
        AttachmentResponse pdf = AttachmentResponse.builder().publicId("pdf").contentType("application/pdf").build();
        Message source = Message.builder().id("prompt").roomId(1L).clientMessageId("prompt-client").threadRootId("root")
                .sender(SenderInfo.builder().sessionId(2L).build()).replyTo(ReplyInfo.builder().messageId("quoted-message").build())
                .attachments(List.of(direct, pdf)).build();
        Message reply = Message.builder().id("quoted-message").roomId(1L).clientMessageId("quoted-client").threadRootId("root")
                .attachments(List.of(direct, quoted)).build();
        when(messages.findById("prompt")).thenReturn(Optional.of(source));
        when(messages.findById("quoted-message")).thenReturn(Optional.of(reply));
        when(links.published(eq(1L), anyString(), anyList())).thenReturn(true);
        AiPromptRequested prompt = new AiPromptRequested("room", 1L, "prompt", 5L, "root", "guest", "hash", "Đọc ảnh", false);

        assertEquals(List.of(direct, quoted), service.getAiImages(prompt));
        reply.setThreadRootId("different-root");
        assertEquals(List.of(direct), service.getAiImages(prompt));
        reply.setThreadRootId("root");
        reply.setRoomId(2L);
        assertEquals(List.of(direct), service.getAiImages(prompt));
    }
}
