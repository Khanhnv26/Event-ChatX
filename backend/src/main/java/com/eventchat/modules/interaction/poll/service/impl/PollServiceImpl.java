package com.eventchat.modules.interaction.poll.service.impl;

import com.eventchat.common.util.TokenUtil;
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
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    @Override
    public PollResponse createPoll(String slug, String rawSessionToken, CreatePollRequest pollRequest) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

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
        messagingTemplate.convertAndSend("/topic/room." + slug + ".polls", response);

        return response;
    }

    @Override
    @Transactional
    public PollResponse castVote(String slug, Long pollId, String rawSessionToken, CastVoteRequest voteRequest) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu session token");
        }

        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không hợp lệ"));

        Poll poll = pollRepository.findById(pollId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy cuộc thăm dò với ID: " + pollId));

        if (!poll.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Cuộc thăm dò không thuộc phòng này");
        }

        if (poll.getStatus() != PollStatus.OPEN) {
            throw new IllegalArgumentException("Cuộc thăm dò đã đóng");
        }

        PollOption option = pollOptionRepository.findById(voteRequest.getOptionId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lựa chọn với ID: " + voteRequest.getOptionId()));

        if (!option.getPoll().getId().equals(poll.getId())) {
            throw new IllegalArgumentException("Lựa chọn không thuộc cuộc thăm dò này");
        }

        if ("MULTIPLE".equals(poll.getRule())) {
            if (pollVoteRepository.existsByPollIdAndSessionIdAndOptionId(poll.getId(), session.getId(), option.getId())) {
                throw new IllegalArgumentException("Bạn đã bỏ phiếu cho lựa chọn này");
            }
        } else {
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
        messagingTemplate.convertAndSend("/topic/room." + slug + ".polls", response);
        return response;
    }

    @Override
    @Transactional
    public PollResponse closePoll(String slug, Long pollId, String rawHostToken) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        if (rawHostToken == null || !TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Chỉ Host mới có quyền đóng cuộc thăm dò");
        }

        Poll poll = pollRepository.findById(pollId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy cuộc thăm dò với ID: " + pollId));

        if (!poll.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Cuộc thăm dò không thuộc phòng này");
        }

        poll.setStatus(PollStatus.CLOSED);
        poll.setClosedAt(Instant.now());
        PollResponse response = mapToPollResponse(pollRepository.save(poll));

        messagingTemplate.convertAndSend("/topic/room." + slug + ".polls", response);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PollResponse> getPollsByRoom(String slug) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));
        List<Poll> polls = pollRepository.findAllByRoomIdOrderByCreatedAtDesc(room.getId());
        return polls.stream().map(this::mapToPollResponse).toList();
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
