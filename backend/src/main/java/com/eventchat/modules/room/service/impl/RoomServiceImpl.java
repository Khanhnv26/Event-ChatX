package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.dto.request.CreateRoomRequest;
import com.eventchat.modules.room.dto.request.JoinRoomRequest;
import com.eventchat.modules.room.dto.response.ParticipantResponse;
import com.eventchat.modules.room.dto.response.RoomAuthResponse;
import com.eventchat.modules.room.dto.response.RoomDetailResponse;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.enums.SessionRole;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;

    @Override
    @Transactional
    public RoomAuthResponse createRoom(CreateRoomRequest request) {

        String slug;
        do {
            slug = TokenUtil.generateSlug();
        } while(roomRepository.existsBySlug(slug));

        String rawHostToken = TokenUtil.generateSecretToken();
        String hostTokenHash =TokenUtil.sha256(rawHostToken);

        int ttlHours = (request.getTtlHours() != null && request.getTtlHours() > 0) ? request.getTtlHours() : 24;

        Instant expiresAt = Instant.now().plus(Duration.ofHours(ttlHours));

        Room room = Room.builder()
                .slug(slug)
                .title(request.getTitle())
                .hostTokenHash(hostTokenHash)
                .roomStatus(RoomStatus.ACTIVE)
                .expiresAt(expiresAt)
                .build();
        roomRepository.save(room);


        String guestId = UUID.randomUUID().toString();
        String rawSessionToken = TokenUtil.generateSecretToken();
        RoomSession session = RoomSession.builder()
                .room(room)
                .guestId(guestId)
                .nickname(request.getHostNickname())
                .role(SessionRole.HOST)
                .sessionTokenHash(TokenUtil.sha256(rawSessionToken))
                .build();
        roomSessionRepository.save(session);


        return RoomAuthResponse.builder()
                .slug(room.getSlug())
                .title(room.getTitle())
                .status(room.getRoomStatus())
                .guestId(guestId)
                .nickname(request.getHostNickname())
                .role(SessionRole.HOST)
                .sessionToken(rawSessionToken)
                .hostToken(rawHostToken)
                .expiresAt(room.getExpiresAt())
                .build();
    }

    @Override
    @Transactional
    public RoomAuthResponse joinRoom(String slug, JoinRoomRequest request) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        if (room.getRoomStatus() != RoomStatus.ACTIVE || Instant.now().isAfter(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng không còn hoạt động");
        }

        String guestId = UUID.randomUUID().toString();
        String rawSessionToken = TokenUtil.generateSecretToken();
        RoomSession session = RoomSession.builder()
                .room(room)
                .guestId(guestId)
                .nickname(request.getNickname())
                .sessionTokenHash(TokenUtil.sha256(rawSessionToken))
                .role(SessionRole.PARTICIPANT)
                .build();
        roomSessionRepository.save(session);


        return RoomAuthResponse.builder()
                .slug(room.getSlug())
                .title(room.getTitle())
                .status(room.getRoomStatus())
                .guestId(guestId)
                .nickname(request.getNickname())
                .role(SessionRole.PARTICIPANT)
                .sessionToken(rawSessionToken)
                .hostToken(null)
                .expiresAt(room.getExpiresAt())
                .build();
    }

    @Override
    @Transactional
    public void closeRoom(String slug, String rawHostToken) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        if (rawHostToken == null || !TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Bạn không có quyền Host để đóng phòng này");
        }

        room.setRoomStatus(RoomStatus.CLOSED);
        room.setClosedAt(Instant.now());
        roomRepository.save(room);
    }

    @Override
    @Transactional(readOnly = true)
    public RoomDetailResponse getRoomDetails(String slug) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        List<ParticipantResponse> participants = roomSessionRepository.findAllByRoomId(room.getId()).stream()
                .map(session -> ParticipantResponse.builder()
                        .guestId(session.getGuestId())
                        .nickname(session.getNickname())
                        .role(session.getRole())
                        .joinedAt(session.getCreatedAt())
                        .lastSeenAt(session.getLastSeenAt())
                        .build())
                .toList();

        return RoomDetailResponse.builder()
                .slug(room.getSlug())
                .title(room.getTitle())
                .status(room.getRoomStatus())
                .settings(room.getSettings())
                .expiresAt(room.getExpiresAt())
                .closedAt(room.getClosedAt())
                .createdAt(room.getCreatedAt())
                .participants(participants)
                .build();
    }

    @Override
    @Transactional
    public RoomAuthResponse reconnect(String slug, String rawSessionToken) {
        if(rawSessionToken == null || rawSessionToken.isEmpty()) {
            throw new SecurityException("Thiếu Session Token để khôi phục phiên");
        }

        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với mã: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository
                .findByRoomIdAndSessionTokenHash(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên tham gia không hợp lệ hoặc không thuộc phòng này"));

        session.setLastSeenAt(Instant.now());
        roomSessionRepository.save(session);

        return RoomAuthResponse.builder()
                .slug(room.getSlug())
                .title(room.getTitle())
                .status(room.getRoomStatus())
                .guestId(session.getGuestId())
                .nickname(session.getNickname())
                .role(session.getRole())
                .sessionToken(rawSessionToken)
                .hostToken(null)
                .expiresAt(room.getExpiresAt())
                .build();
    }
}
