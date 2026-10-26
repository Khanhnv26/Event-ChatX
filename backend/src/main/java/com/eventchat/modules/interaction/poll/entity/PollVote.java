package com.eventchat.modules.interaction.poll.entity;

import com.eventchat.common.entity.BaseEntity;
import com.eventchat.modules.room.entity.RoomSession;
import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Table(name = "poll_votes", uniqueConstraints = {
        @UniqueConstraint(name = "uk_poll_vote", columnNames = {"poll_id", "option_id", "session_id"})
})
public class PollVote extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @ManyToOne
    @JoinColumn(name = "option_id", nullable = false)
    private PollOption option;

    @ManyToOne
    @JoinColumn(name = "session_id", nullable = false)
    private RoomSession session;

}
