package com.eventchat.modules.interaction.wheel.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.entity.Room;
import jakarta.persistence.*;
import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@Entity
@Table(name = "wheels")
public class Wheel extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "title", length = 255, nullable = false)
    private String title;

    @Column(name = "entries", length = 2048, nullable = false)
    private String entries;

    @Column(name = "rules", length = 1024, nullable = false)
    private String rules;

}
