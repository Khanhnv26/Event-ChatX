package com.eventchat.modules.chat.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "room_message_pins")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RoomMessagePin {
    @Id
    @Column(name = "room_id")
    private Long roomId;

    @Column(name = "message_id", length = 64, nullable = false)
    private String messageId;
}
