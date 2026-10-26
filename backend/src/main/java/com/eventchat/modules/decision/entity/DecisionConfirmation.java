package com.eventchat.modules.decision.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.decision.enums.ConfirmationChoice;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "decision_confirmations", uniqueConstraints = {
        @UniqueConstraint(name = "uk_decision_confirmation", columnNames = {"decision_id", "session_id"})
})
@Entity
@Builder
public class DecisionConfirmation extends BaseEntity {
    @ManyToOne
    @JoinColumn(name = "decision_id", nullable = false)
    private Decision decision;

    @ManyToOne
    @JoinColumn(name = "session_id", nullable = false)
    private RoomSession session;

    @Enumerated(EnumType.STRING)
    @Column(name = "choice", nullable = false, length = 32)
    private ConfirmationChoice choice;
}
