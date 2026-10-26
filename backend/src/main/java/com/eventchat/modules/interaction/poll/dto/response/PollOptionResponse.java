package com.eventchat.modules.interaction.poll.dto.response;


import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class PollOptionResponse {
    private Long id;
    private String label;
    private Integer voteCount;
    private Integer displayOrder;

}
