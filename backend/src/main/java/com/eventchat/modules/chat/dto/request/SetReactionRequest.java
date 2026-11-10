package com.eventchat.modules.chat.dto.request;

import com.eventchat.modules.chat.enums.ReactionEmoji;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SetReactionRequest {
    @NotNull(message = "Vui lòng chọn một cảm xúc")
    private ReactionEmoji emoji;

    @NotNull(message = "Vui lòng chọn trạng thái cảm xúc")
    private Boolean active;
}
