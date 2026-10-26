package com.eventchat.modules.interaction.wheel.entity;


import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "wheel_spins")
@Getter
@Setter
@Builder
public class WheelSpin extends BaseEntity {
    @ManyToOne
    @JoinColumn(name = "wheel_id", nullable = false)
    private Wheel wheel;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne
    @JoinColumn(name = "actor_session_id", nullable = false)
    private RoomSession roomSession;

    @Column(name = "idempotency_key", length = 64, nullable = false, unique = true)
    private String idempotencyKey;

    @Column(name = "entries_snapshot", length = 2048, nullable = false)
    private String entriesSnapshot;

    @Column(name = "result_entry", length = 255, nullable = false)
    private String resultEntry;
}
