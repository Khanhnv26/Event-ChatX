package com.eventchat.modules.chat.entity;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReplyInfo {
    private String messageId;
    private Long sequence;
    private String senderNickname;
    private String snippet;
}
