package com.eventchat.modules.interaction.poll.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.interaction.poll.dto.request.CastVoteRequest;
import com.eventchat.modules.interaction.poll.dto.request.CreatePollRequest;
import com.eventchat.modules.interaction.poll.entity.Poll;
import com.eventchat.modules.interaction.poll.entity.PollOption;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.interaction.poll.repository.*;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PollServiceImplTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final PollRepository polls = mock(PollRepository.class);
    private final PollOptionRepository options = mock(PollOptionRepository.class);
    private final PollVoteRepository votes = mock(PollVoteRepository.class);
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final PollServiceImpl service = new PollServiceImpl(rooms, sessions, polls, options, votes, broker);
    private Room room;
    private Poll poll;
    private PollOption option;

    @BeforeEach
    void setup() {
        room = Room.builder().slug("room").expiresAt(Instant.now().plusSeconds(3600)).build();
        room.setId(1L);
        RoomSession session = new RoomSession();
        session.setId(2L);
        poll = Poll.builder().room(room).rule("SINGLE").status(PollStatus.OPEN).build();
        poll.setId(3L);
        option = PollOption.builder().poll(poll).label("A").voteCount(0).displayOrder(0).build();
        option.setId(4L);
        poll.setOptions(List.of(option));
        when(rooms.findBySlug("room")).thenReturn(Optional.of(room));
        when(rooms.findBySlugForUpdate("room")).thenReturn(Optional.of(room));
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("token")))
                .thenReturn(Optional.of(session));
        when(polls.findByIdForUpdate(3L)).thenReturn(Optional.of(poll));
        when(options.findById(4L)).thenReturn(Optional.of(option));
        when(polls.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void participantCannotCreatePoll() {
        var participant = RoomSession.builder().room(room).role(com.eventchat.modules.room.enums.SessionRole.PARTICIPANT).build();
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("token")))
                .thenReturn(Optional.of(participant));
        assertThrows(SecurityException.class, () -> service.createPoll("room", "token", CreatePollRequest.builder()
                .question("Choose").options(List.of("A", "B")).build()));
        verify(polls, never()).save(any());
        verifyNoInteractions(broker);
    }

    @Test
    void closedRoomRejectsVoting() {
        room.setRoomStatus(RoomStatus.CLOSED);
        assertThrows(IllegalArgumentException.class, () -> vote());
        verifyNoInteractions(votes);
    }

    @Test
    void expiredRoomRejectsVotingBeforeExpiryJobRuns() {
        room.setExpiresAt(Instant.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> vote());
        verifyNoInteractions(votes);
    }

    @Test
    void closedRoomRejectsCreatingPolls() {
        room.setRoomStatus(RoomStatus.CLOSED);
        assertThrows(IllegalArgumentException.class, () -> service.createPoll("room", "token",
                CreatePollRequest.builder().question("Q").options(List.of("A", "B")).build()));
        verify(polls, never()).save(any());
    }

    @Test
    void retryingSameVoteReturnsCountsWithoutWritingAgain() {
        when(votes.existsByPollIdAndSessionIdAndOptionId(3L, 2L, 4L)).thenReturn(true);
        when(votes.existsByPollIdAndSessionId(3L, 2L)).thenReturn(true);
        assertDoesNotThrow(() -> vote());
        verify(votes, never()).save(any());
        verify(options, never()).save(any());
    }

    @Test
    void singleChoiceRejectsAnotherOption() {
        when(votes.existsByPollIdAndSessionId(3L, 2L)).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> vote());
        verify(votes, never()).save(any());
    }

    @Test
    void multipleChoiceAllowsVotingForAnotherOption() {
        poll.setRule("MULTIPLE");
        when(votes.existsByPollIdAndSessionId(3L, 2L)).thenReturn(true);
        assertEquals(1, vote().getOptions().getFirst().getVoteCount());
        verify(votes).save(any());
    }

    @Test
    void closedPollRejectsVotes() {
        poll.setStatus(PollStatus.CLOSED);
        assertThrows(IllegalArgumentException.class, () -> vote());
        verifyNoInteractions(votes);
    }

    private com.eventchat.modules.interaction.poll.dto.response.PollResponse vote() {
        return service.castVote("room", 3L, "token", CastVoteRequest.builder().optionId(4L).build());
    }
}
