package com.eventchat.modules.room.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.eventchat.modules.room.service.RoomAccessService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RoomAccessImpl implements RoomAccessService {
    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;

    @Override
    @Transactional(readOnly = true)
    public void requireReadAccess(String slug, String rawSessionToken) {
        if(rawSessionToken == null || rawSessionToken.isBlank()) {
            throw new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi");
        }

        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new SecurityException("Phòng không tồn tại"));

        String tokenHash = TokenUtil.sha256(rawSessionToken);

        roomSessionRepository.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(room.getId(), tokenHash)
                .orElseThrow(() -> new SecurityException("Phiên tham gia không hợp lệ hoặc đã bị thu hồi"));
    }
}
