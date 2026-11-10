package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.cache.SessionSnapshot;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomAccessService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class RoomAccessImpl implements RoomAccessService {
    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;

    @Override
    @Transactional(readOnly = true)
    public void requireReadAccess(String slug, String rawSessionToken) {
        readSession(slug, rawSessionToken);
    }

    @Override
    @Transactional(readOnly = true)
    public SessionSnapshot readSession(String slug, String rawSessionToken) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi");
        }
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new SecurityException("Phòng không tồn tại"));
        return requireSession(room, rawSessionToken);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public SessionSnapshot lockWritableSession(String slug, String rawSessionToken) {
        if (rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi");
        }
        return requireSession(lockWritableRoom(slug), rawSessionToken);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public Long lockWritableRoomForHost(String slug, String rawHostToken) {
        if (rawHostToken == null || rawHostToken.isBlank()) throw new SecurityException("Thiếu Host Token");
        Room room = lockWritableRoom(slug);
        if (!TokenUtil.sha256(rawHostToken).equals(room.getHostTokenHash())) {
            throw new SecurityException("Chỉ Host được cập nhật tin nhắn ghim");
        }
        return room.getId();
    }

    private Room lockWritableRoom(String slug) {
        Room room = roomRepository.findBySlugForUpdate(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng"));
        if (room.getRoomStatus() != RoomStatus.ACTIVE || !Instant.now().isBefore(room.getExpiresAt())) {
            throw new IllegalArgumentException("Phòng đã đóng hoặc hết hạn");
        }
        return room;
    }

    private SessionSnapshot requireSession(Room room, String rawSessionToken) {
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(
                room.getId(), TokenUtil.sha256(rawSessionToken))
                .orElseThrow(() -> new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi"));
        return SessionSnapshot.builder().roomId(room.getId()).sessionId(session.getId())
                .guestId(session.getGuestId()).nickname(session.getNickname()).role(session.getRole()).build();
    }
}
