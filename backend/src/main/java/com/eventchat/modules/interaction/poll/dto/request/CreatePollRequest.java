package com.eventchat.modules.interaction.poll.dto.request;

import com.eventchat.modules.interaction.poll.entity.PollOption;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class CreatePollRequest {
    @NotBlank(message = "Câu hỏi không được để trống")
    private String question;

    @NotEmpty(message = "Danh sách lựa chọn không được để trống")
    @Size(min = 2, max = 10, message = "Cần ít nhất 2 và nhiều nhất 10 lựa chọn")
    private List<String> options;

    @Builder.Default
    private boolean allowMultiple = false;
}
