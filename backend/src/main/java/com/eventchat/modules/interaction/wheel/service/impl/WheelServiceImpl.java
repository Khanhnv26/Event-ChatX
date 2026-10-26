package com.eventchat.modules.interaction.wheel.service.impl;


import com.eventchat.common.util.TokenUtil;
import com.eventchat.modules.interaction.wheel.dto.request.CreateWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.request.SpinWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.response.WheelResponse;
import com.eventchat.modules.interaction.wheel.dto.response.WheelSpinResponse;
import com.eventchat.modules.interaction.wheel.entity.Wheel;
import com.eventchat.modules.interaction.wheel.entity.WheelSpin;
import com.eventchat.modules.interaction.wheel.repository.WheelRepository;
import com.eventchat.modules.interaction.wheel.repository.WheelSpinRepository;
import com.eventchat.modules.interaction.wheel.service.WheelService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WheelServiceImpl implements WheelService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final RoomRepository roomRepository;
    private final RoomSessionRepository roomSessionRepository;
    private final WheelRepository wheelRepository;
    private final WheelSpinRepository wheelSpinRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public WheelResponse createWheel(String slug, String rawSessionToken, CreateWheelRequest request) {

        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash).orElseThrow(()
                -> new IllegalArgumentException("Phiên làm việc không hợp lệ"));

        Wheel wheel = Wheel.builder()
                .room(room)
                .title(request.getTitle())
                .entries(toJson(request.getEntries()))
                .rules(request.isExcludeWinner() ? "EXCLUDE_WINNER" : "KEEP_WINNER")
                .build();

        wheelRepository.save(wheel);

        WheelResponse response = mapToWheelResponse(wheel);

        messagingTemplate.convertAndSend("/topic/rooms/" + slug + "/wheels", response);
        return response;
    }

    @Override
    @Transactional
    public WheelSpinResponse spinWheel(String slug, Long wheelId, String rawSessionToken, SpinWheelRequest request) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        String tokenHash = TokenUtil.sha256(rawSessionToken);
        RoomSession session = roomSessionRepository.findByRoomIdAndSessionTokenHash(room.getId(), tokenHash).orElseThrow(()
                -> new IllegalArgumentException("Phiên làm việc không hợp lệ"));

        Wheel wheel = wheelRepository.findById(wheelId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy vòng quay với ID: " + wheelId));

        if (!wheel.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Vòng quay không thuộc phòng này");
        }

        Optional<WheelSpin> existingSpin = wheelSpinRepository.findByWheelIdAndIdempotencyKey(wheelId, request.getIdempotencyKey());
        if (existingSpin.isPresent()) {
            return mapToSpinResponse(existingSpin.get());
        }

        List<String> currentEntries = fromJson(wheel.getEntries());
        if (currentEntries.isEmpty()) {
            throw new IllegalStateException("Không còn mục nào để quay");
        }
        String snapShotJson = toJson(currentEntries);
        int winingIndex = SECURE_RANDOM.nextInt(currentEntries.size());
        String winner = currentEntries.get(winingIndex);

        if("EXCLUDE_WINNER".equals(wheel.getRules())) {
            currentEntries.remove(winingIndex);
            wheel.setEntries(toJson(currentEntries));
            wheelRepository.save(wheel);
        }

        WheelSpin spin = WheelSpin.builder()
                .wheel(wheel)
                .room(room)
                .roomSession(session)
                .idempotencyKey(request.getIdempotencyKey())
                .entriesSnapshot(snapShotJson)
                .resultEntry(winner)
                .build();
        wheelSpinRepository.save(spin);
        WheelSpinResponse response = mapToSpinResponse(spin);
        messagingTemplate.convertAndSend("/topic/rooms/" + slug + "/wheels/" + wheelId + "/spins", response);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<WheelResponse> getWheelsByRoom(String slug) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));
        return  wheelRepository.findAllByRoomIdOrderByCreatedAtDesc(room.getId()).stream()
                .map(this::mapToWheelResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WheelSpinResponse> getSpinsByWheel(String slug, Long wheelId) {
        Room room = roomRepository.findBySlug(slug).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy phòng với slug: " + slug));

        Wheel wheel = wheelRepository.findById(wheelId).orElseThrow(()
                -> new IllegalArgumentException("Không tìm thấy vòng quay với ID: " + wheelId));

        if (!wheel.getRoom().getId().equals(room.getId())) {
            throw new IllegalArgumentException("Vòng quay không thuộc phòng này");
        }

        return wheelSpinRepository.findAllByWheelIdOrderByCreatedAtDesc(wheelId).stream()
                .map(this::mapToSpinResponse)
                .toList();
    }

    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Lỗi chuyển danh sách sang JSON", e);
        }
    }

    private List<String> fromJson(String json) {
        try {
            return new ArrayList<>(objectMapper.readValue(json, new TypeReference<List<String>>() {
            }));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Lỗi đọc danh sách từ JSON", e);
        }
    }

    private WheelSpinResponse mapToSpinResponse(WheelSpin spin) {
        return WheelSpinResponse.builder()
                .id(spin.getId())
                .wheelId(spin.getWheel().getId())
                .actorNickname(spin.getRoomSession().getNickname())
                .idempotencyKey(spin.getIdempotencyKey())
                .resultEntry(spin.getResultEntry())
                .entriesSnapshot(fromJson(spin.getEntriesSnapshot()))
                .createdAt(spin.getCreatedAt())
                .build();
    }

    private WheelResponse mapToWheelResponse(Wheel wheel) {
        return WheelResponse.builder()
                .id(wheel.getId())
                .title(wheel.getTitle())
                .entries(fromJson(wheel.getEntries()))
                .excludeWinner("EXCLUDE_WINNER".equals(wheel.getRules()))
                .createdAt(wheel.getCreatedAt())
                .spins(getSpinsByWheel(wheel.getRoom().getSlug(), wheel.getId()))
                .build();
    }
}