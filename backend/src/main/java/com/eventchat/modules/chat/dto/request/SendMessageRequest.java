package com.eventchat.modules.chat.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.validator.constraints.Length;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Setter
@Getter
public class SendMessageRequest {

    @NotBlank(message = "Không thấy client ID của tin nhắn")
    @Length(max = 64, message = "Client ID của tin nhắn không được vượt quá 64 ký tự")
    private String clientMessageId;

    @Length(max = 2048, message = "Nội dung tin nhắn không được vượt quá 2048 ký tự")
    private String body;

    private String replyToId;

    @Size(max = 4, message = "Tối đa 4 tệp mỗi tin nhắn")
    private List<@NotBlank @Pattern(regexp = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") String> attachmentIds;

    @AssertTrue(message = "Tin nhắn phải có nội dung hoặc tệp đính kèm")
    public boolean isContentPresent() {
        return body != null && !body.isBlank() || attachmentIds != null && !attachmentIds.isEmpty();
    }
}
