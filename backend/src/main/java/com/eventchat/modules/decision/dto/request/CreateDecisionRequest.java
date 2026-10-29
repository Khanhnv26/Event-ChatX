package com.eventchat.modules.decision.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateDecisionRequest {

    @NotBlank(message = "Nội dung quyết định không được để trống")
    private String text;

    private Long sourceSpinId;

    private List<String> evidenceRefs;

    @Builder.Default
    private boolean proposeImmediately = true;
}
