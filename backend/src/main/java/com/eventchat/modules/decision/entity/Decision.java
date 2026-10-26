package com.eventchat.modules.decision.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@Entity
@Table(name = "decisions")
public class Decision extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private RoomSession createdBy;

    @Column(name = "text", columnDefinition = "TEXT", nullable = false)
    private String text;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private DecisionStatus status = DecisionStatus.DRAFT;

    @Column(name = "evidence_refs", length = 1024)
    private String evidenceRefs;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

}
