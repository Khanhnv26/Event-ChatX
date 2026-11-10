package com.eventchat.modules.chat.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PinMessageRequest {
    @NotBlank(message = "Thiếu mã tin nhắn cần ghim")
    @Size(max = 64, message = "Mã tin nhắn không hợp lệ")
    private String messageId;
}
