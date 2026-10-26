package com.eventchat.modules.interaction.wheel.service;

import com.eventchat.modules.interaction.wheel.dto.request.CreateWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.request.SpinWheelRequest;
import com.eventchat.modules.interaction.wheel.dto.response.WheelResponse;
import com.eventchat.modules.interaction.wheel.dto.response.WheelSpinResponse;

import java.util.List;

public interface WheelService {
    WheelResponse createWheel(String slug, String rawSessionToken, CreateWheelRequest request);
    WheelSpinResponse spinWheel(String slug, Long wheelId, String rawSessionToken, SpinWheelRequest request);
    List<WheelResponse> getWheelsByRoom(String slug);
    List<WheelSpinResponse> getSpinsByWheel(String slug, Long wheelId);


}
