package com.eventchat.modules.room.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateJoinLockRequest {

    @NotNull(message = "Phải cung cấp trạng thái khóa tham gia")
    private Boolean joinLocked;
}
