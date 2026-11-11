package com.eventchat.modules.chat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageMention {
    @Size(max = 64)
    private String guestId;

    @NotNull
    @PositiveOrZero
    private Integer start;

    @NotNull
    @Positive
    private Integer end;

    private boolean everyone;
}
