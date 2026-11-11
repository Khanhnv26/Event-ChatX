package com.eventchat.modules.interaction.poll.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.common.event.RealtimeEventPublisher;
import com.eventchat.modules.interaction.poll.dto.request.CastVoteRequest;
import com.eventchat.modules.interaction.poll.dto.request.CreatePollRequest;
import com.eventchat.modules.interaction.poll.dto.request.UpdateVotesRequest;
import com.eventchat.modules.interaction.poll.dto.response.PollOptionResponse;
import com.eventchat.modules.interaction.poll.dto.response.PollResponse;
import com.eventchat.modules.interaction.poll.entity.Poll;
import com.eventchat.modules.interaction.poll.entity.PollOption;
import com.eventchat.modules.interaction.poll.entity.PollVote;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.interaction.poll.enums.PollType;
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
import java.util.Comparator;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PollServiceImpl implements PollService {
    private static final List<String> RATING_OPTIONS = List.of("1 sao", "2 sao", "3 sao", "4 sao", "5 sao");

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final PollRepository pollRepository;
    private final PollOptionRepository pollOptionRepository;
    private final PollVoteRepository pollVoteRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional(readOnly = true)
    public void requireClosedPoll(Long roomId, Long pollId) {
        if (!pollRepository.existsByIdAndRoomIdAndStatus(pollId, roomId, PollStatus.CLOSED)) {
            throw new IllegalArgumentException("Bình chọn nguồn phải thuộc phòng này và đã kết thúc");
        }
    }

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
        PollType type = pollRequest.getType();
        if (type == null) type = pollRequest.isAllowMultiple() ? PollType.MULTIPLE : PollType.SINGLE;
        List<String> labels = type == PollType.RATING ? RATING_OPTIONS : pollRequest.getOptions();
        Poll poll = Poll.builder()
                .room(room)
                .creatorSession(session)
                .question(pollRequest.getQuestion())
                .status(PollStatus.OPEN)
                .rule(type.name())
                .build();

        for (int i = 0; i < labels.size(); i++) {
            String optionText = labels.get(i);
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
        if (PollType.fromRule(poll.getRule()) == PollType.RANKING) {
            throw new IllegalArgumentException("Vui lòng gửi danh sách xếp hạng theo thứ tự ưu tiên");
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

        poll.setRevision(poll.getRevision() + 1);
        pollRepository.save(poll);

        PollResponse response = mapToPollResponse(poll);
        broadcastAfterCommit(slug, response);
        return withOwnVotes(mapToPollResponse(poll), session.getId());
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PollResponse updateVotes(String slug, Long pollId, String rawSessionToken,
            UpdateVotesRequest request) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) throw new IllegalArgumentException("Thiếu session token");
        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng"));
        requireWritable(room);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(
                room.getId(), TokenUtil.sha256(rawSessionToken))
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));
        Poll poll = pollRepository.findByIdForUpdate(pollId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bình chọn"));
        if (!poll.getRoom().getId().equals(room.getId())) throw new IllegalArgumentException("Bình chọn không thuộc phòng này");
        requireWritable(room);
        if (poll.getStatus() != PollStatus.OPEN) throw new IllegalArgumentException("Bình chọn đã kết thúc");
        PollType type = PollType.fromRule(poll.getRule());
        List<Long> ids = request.getOptionIds();
        Map<Long, PollOption> options = poll.getOptions().stream()
                .collect(Collectors.toMap(PollOption::getId, Function.identity()));
        if (ids == null || ids.size() > type.maxChoices() || ids.stream().anyMatch(id -> id == null || id <= 0)
                || ids.stream().distinct().count() != ids.size()
                || ids.stream().anyMatch(id -> !options.containsKey(id))) {
            throw new IllegalArgumentException("Danh sách phương án không hợp lệ");
        }
        List<PollVote> existing = pollVoteRepository.findAllByPollIdAndSessionId(pollId, session.getId());
        List<Long> oldIds = optionIds(existing, type);
        boolean ranked = type == PollType.RANKING;
        boolean changed = ranked ? !oldIds.equals(ids) : !new HashSet<>(oldIds).equals(new HashSet<>(ids));
        if (changed) {
            applyBallot(poll, session, options, existing, ids, ranked);
            poll.setRevision(poll.getRevision() + 1);
            pollRepository.save(poll);
            broadcastAfterCommit(slug, mapToPollResponse(poll));
        }
        PollResponse response = mapToPollResponse(poll);
        response.setVotedOptionIds(List.copyOf(ids));
        return response;
    }

    private void applyBallot(Poll poll, RoomSession session, Map<Long, PollOption> options,
                             List<PollVote> existing, List<Long> ids, boolean ranked) {
        Map<Long, PollVote> previous = existing.stream()
                .collect(Collectors.toMap(vote -> vote.getOption().getId(), Function.identity()));
        for (PollVote vote : existing) {
            Long optionId = vote.getOption().getId();
            if (!ids.contains(optionId)) {
                updateTally(options.get(optionId), -1, -points(vote.getRankPosition()));
                pollVoteRepository.delete(vote);
            }
        }
        for (int index = 0; index < ids.size(); index++) {
            Long optionId = ids.get(index);
            PollOption option = options.get(optionId);
            Integer rank = ranked ? index + 1 : null;
            PollVote old = previous.get(optionId);
            if (old == null) {
                updateTally(option, 1, points(rank));
                pollVoteRepository.save(PollVote.builder().poll(poll).session(session)
                        .option(option).rankPosition(rank).build());
            } else if (!Objects.equals(old.getRankPosition(), rank)) {
                updateTally(option, 0, points(rank) - points(old.getRankPosition()));
                old.setRankPosition(rank);
                pollVoteRepository.save(old);
            }
        }
    }

    private void updateTally(PollOption option, int voteDelta, int scoreDelta) {
        option.setVoteCount(option.getVoteCount() + voteDelta);
        option.setRankingScore(option.getRankingScore() + scoreDelta);
        pollOptionRepository.save(option);
    }

    private int points(Integer rank) {
        return rank == null ? 0 : 4 - rank;
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
        poll.setRevision(poll.getRevision() + 1);
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
        response.setVotedOptionIds(optionIds(
                pollVoteRepository.findAllByPollIdAndSessionId(response.getId(), sessionId), response.getType()));
        return response;
    }

    private List<Long> optionIds(List<PollVote> votes, PollType type) {
        if (type == PollType.RANKING) {
            return votes.stream().sorted(Comparator.comparing(PollVote::getRankPosition,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(vote -> vote.getOption().getId()).toList();
        }
        return votes.stream().map(vote -> vote.getOption().getId()).toList();
    }

    private void broadcastAfterCommit(String slug, PollResponse response) {
        RealtimeEventPublisher.afterCommit(messagingTemplate, "/topic/room." + slug + ".polls", response);
    }

    private PollResponse mapToPollResponse(Poll poll) {
        PollType type = PollType.fromRule(poll.getRule());
        return PollResponse.builder()
                .id(poll.getId())
                .revision(poll.getRevision())
                .question(poll.getQuestion())
                .status(poll.getStatus())
                .type(type)
                .allowMultiple(type == PollType.MULTIPLE)
                .createdAt(poll.getCreatedAt())
                .closedAt(poll.getClosedAt())
                .options(poll.getOptions().stream().map(option -> PollOptionResponse.builder()
                        .id(option.getId())
                        .label(option.getLabel())
                        .voteCount(option.getVoteCount())
                        .displayOrder(option.getDisplayOrder())
                        .rankingScore(option.getRankingScore())
                        .build()).toList())
                .build();
    }
}
