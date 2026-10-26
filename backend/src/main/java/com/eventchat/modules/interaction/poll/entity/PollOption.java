package com.eventchat.modules.interaction.poll.entity;

import com.eventchat.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Table(name = "poll_options")
public class PollOption extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @Column(name = "label", nullable = false, length = 255)
    private String label;

    @Column(name = "vote_count", nullable = false)
    private Integer voteCount;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;
}
