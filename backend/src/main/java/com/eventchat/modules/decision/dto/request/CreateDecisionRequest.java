package com.eventchat.modules.decision.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
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

    @Positive(message = "Mã bình chọn nguồn không hợp lệ")
    private Long sourcePollId;

    @Size(min = 1, max = 64)
    private String sourceAttachmentMessageId;

    private List<String> evidenceRefs;

    @Builder.Default
    private boolean proposeImmediately = true;
}
