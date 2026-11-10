package com.eventchat.modules.chat.dto.response;

import com.eventchat.modules.chat.enums.ReactionEmoji;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ReactionResponse {
    private final ReactionEmoji emoji;
    private final long count;
    private final boolean reactedByMe;
}
