package com.eventchat.modules.interaction.poll.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.modules.interaction.poll.dto.request.CastVoteRequest;
import com.eventchat.modules.interaction.poll.dto.request.CreatePollRequest;
import com.eventchat.modules.interaction.poll.dto.response.PollOptionResponse;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.entity.Poll;
import com.eventchat.modules.interaction.poll.entity.PollOption;
import com.eventchat.modules.interaction.poll.entity.PollVote;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.interaction.poll.repository.PollOptionRepository;
import com.eventchat.modules.interaction.poll.repository.PollRepository;
import com.eventchat.modules.interaction.poll.repository.PollVoteRepository;
import com.eventchat.modules.interaction.poll.service.PollService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PollServiceImpl implements PollService {

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final PollRepository pollRepository;
    private final PollOptionRepository pollOptionRepository;
    private final PollVoteRepository pollVoteRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    @Override
    public PollResponse createPoll(String slug, String rawSessionToken, CreatePollRequest pollRequest) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));
        requireWritable(room);

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        if (session.getRole() != com.eventchat.modules.room.enums.SessionRole.HOST) {
            throw new SecurityException("Chỉ Host được tạo bình chọn");
        }
        Poll poll = Poll.builder()
                .room(room)
                .creatorSession(session)
                .question(pollRequest.getQuestion())
                .status(PollStatus.OPEN)
                .rule(pollRequest.isAllowMultiple() ? "MULTIPLE" : "SINGLE")
                .build();

        for (int i = 0; i < pollRequest.getOptions().size(); i++) {
            String optionText = pollRequest.getOptions().get(i);
            PollOption option = PollOption.builder()
                    .poll(poll)
                    .label(optionText)
                    .voteCount(0)
                    .displayOrder(i)
                    .build();
            poll.getOptions().add(option);
        }

        PollResponse response = mapToPollResponse(pollRepository.save(poll));
        broadcastAfterCommit(slug, response);

        return response;
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PollResponse castVote(String slug, Long pollId, String rawSessionToken, CastVoteRequest voteRequest) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlugForUpdate(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));
        requireWritable(room);

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        Poll poll = pollRepository.findByIdForUpdate(pollId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy cuộc thăm dò với ID: " + pollId));

        if (!poll.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Cuộc thăm dò không thuộc phòng này");
        }

        requireWritable(room);

        if (poll.getStatus() != PollStatus.OPEN) {
            throw new IllegalArgumentException("Cuộc thăm dò đã đóng");
        }

        PollOption option = pollOptionRepository.findById(voteRequest.getOptionId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lựa chọn với ID: " + voteRequest.getOptionId()));

        if (!option.getPoll().getId().equals(poll.getId())) {
            throw new IllegalArgumentException("Lựa chọn không thuộc cuộc thăm dò này");
        }

        if (pollVoteRepository.existsByPollIdAndSessionIdAndOptionId(poll.getId(), session.getId(), option.getId())) {
            return withOwnVotes(mapToPollResponse(poll), session.getId());
        }
        if (!"MULTIPLE".equals(poll.getRule())) {
            if (pollVoteRepository.existsByPollIdAndSessionId(poll.getId(), session.getId())) {
                throw new IllegalArgumentException("Bạn đã bỏ phiếu cho cuộc thăm dò này");
            }
        }

        PollVote vote = PollVote.builder()
                .poll(poll)
                .option(option)
                .session(session)
                .build();
        option.setVoteCount(option.getVoteCount() + 1);
        pollOptionRepository.save(option);
        pollVoteRepository.save(vote);

        PollResponse response = mapToPollResponse(poll);
        broadcastAfterCommit(slug, response);
        return withOwnVotes(mapToPollResponse(poll), session.getId());
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PollResponse closePoll(String slug, Long pollId, String rawHostToken) {
        Room room = roomRepository.findBySlugForUpdate(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        if (rawHostToken == null || !TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Chỉ Host mới có quyền đóng cuộc thăm dò");
        }

        requireWritable(room);

        Poll poll = pollRepository.findByIdForUpdate(pollId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy cuộc thăm dò với ID: " + pollId));

        if (!poll.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Cuộc thăm dò không thuộc phòng này");
        }

        requireWritable(room);

        if (poll.getStatus() == PollStatus.CLOSED) {
            return mapToPollResponse(poll);
        }
        poll.setStatus(PollStatus.CLOSED);
        poll.setClosedAt(Instant.now());
        PollResponse response = mapToPollResponse(pollRepository.save(poll));

        broadcastAfterCommit(slug, response);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PollResponse> getPollsByRoom(String slug) {
        return getPollsByRoom(slug, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PollResponse> getPollsByRoom(String slug, String rawSessionToken) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        Long sessionId = rawSessionToken == null || rawSessionToken.isBlank() ? null :
                roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), TokenUtil.sha256(rawSessionToken))
                        .map(RoomSession::getId).orElse(null);

        List<Poll> polls = pollRepository.findAllByRoomIdOrderByCreatedAtDesc(room.getId());

        return polls.stream().map(this::mapToPollResponse)
                .map(response -> sessionId == null ? response : withOwnVotes(response, sessionId)).toList();
    }

    private void requireWritable(Room room) {
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !Instant.now().isBefore(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng đã đóng hoặc hết hạn");
        }
    }

    private PollResponse withOwnVotes(PollResponse response, Long sessionId) {
        response.setVotedOptionIds(pollVoteRepository.findAllByPollIdAndSessionId(response.getId(), sessionId)
                .stream().map(vote -> vote.getOption().getId()).toList());
        return response;
    }

    private void broadcastAfterCommit(String slug, PollResponse response) {
        RealtimeEventPublisher.afterCommit(messagingTemplate, "/topic/room." + slug + ".polls", response);
    }

    private PollResponse mapToPollResponse(Poll poll) {
        return PollResponse.builder()
                .id(poll.getId())
                .question(poll.getQuestion())
                .status(poll.getStatus())
                .allowMultiple("MULTIPLE".equals(poll.getRule()))
                .createdAt(poll.getCreatedAt())
                .closedAt(poll.getClosedAt())
                .options(poll.getOptions().stream().map(option -> PollOptionResponse.builder()
                        .id(option.getId())
                        .label(option.getLabel())
                        .voteCount(option.getVoteCount())
                        .displayOrder(option.getDisplayOrder())
                        .build()).toList())
                .build();
    }
}
