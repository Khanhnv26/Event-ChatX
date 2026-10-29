package com.eventchat.modules.chat.repository;

import lombok.*;
import org.springframework.data.annotation.Id;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ThreadReplyCount {
    @Id private String id;
    private long count;
}
