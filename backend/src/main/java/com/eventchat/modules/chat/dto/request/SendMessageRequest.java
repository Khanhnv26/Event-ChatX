package com.eventchat.modules.chat.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.validator.constraints.Length;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Setter
@Getter
public class SendMessageRequest {

    @NotBlank(message = "Không thấy client ID của tin nhắn")
    @Length(max = 64, message = "Client ID của tin nhắn không được vượt quá 64 ký tự")
    private String clientMessageId;

    @NotBlank(message = "Không thấy nội dung tin nhắn")
    @Length(max = 2048, message = "Nội dung tin nhắn không được vượt quá 2048 ký tự")
    private String body;

    private String replyToId;
}
