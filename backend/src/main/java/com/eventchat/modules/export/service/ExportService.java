package com.eventchat.modules.export.service;

import com.eventchat.modules.export.dto.response.RoomExportResponse;

public interface ExportService {

    RoomExportResponse exportRoomSummary(String slug);
}
