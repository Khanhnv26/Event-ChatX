package com.eventchat.modules.interaction.poll.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.interaction.poll.enums.PollStatus;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@Table(name = "polls")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Poll extends BaseEntity {

    @Column(name = "revision", nullable = false)
    private long revision;

    @OneToMany(mappedBy = "poll", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<PollOption> options = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_session_id", nullable = false)
    private RoomSession creatorSession;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private PollStatus status = PollStatus.OPEN;

    @Column(name = "rules", length = 1024, nullable = false)
    @Builder.Default
    private String rule = "{}";

    @Column(name = "closed_at")
    private Instant closedAt;
}
