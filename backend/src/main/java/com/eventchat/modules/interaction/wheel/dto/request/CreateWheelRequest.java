package com.eventchat.modules.interaction.wheel.dto.request;

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
public class CreateWheelRequest {

    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    @NotEmpty(message = "Danh sách quay không được để trống")
    @Size(min = 2, max = 100, message = "Cần ít nhất 2 và tối đa 100 mục")
    private List<String> entries;

    @Builder.Default
    private boolean excludeWinner = false;
}
