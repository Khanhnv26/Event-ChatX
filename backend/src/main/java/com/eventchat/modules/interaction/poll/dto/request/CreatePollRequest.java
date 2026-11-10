package com.eventchat.modules.interaction.poll.dto.request;

import com.eventchat.modules.interaction.poll.enums.PollType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
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

    @Size(max = 10, message = "Tối đa 10 lựa chọn")
    private List<@NotBlank(message = "Lựa chọn không được để trống") @Size(max = 255, message = "Lựa chọn tối đa 255 ký tự") String> options;

    @Builder.Default
    private boolean allowMultiple = false;

    private PollType type;

    @AssertTrue(message = "Cần ít nhất 2 lựa chọn cho dạng bình chọn này")
    public boolean isOptionCountValid() {
        return type == PollType.RATING || (options != null && options.size() >= 2);
    }
}
