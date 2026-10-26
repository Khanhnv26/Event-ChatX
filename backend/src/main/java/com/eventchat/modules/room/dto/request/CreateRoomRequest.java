package com.eventchat.modules.room.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.validator.constraints.Length;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class CreateRoomRequest {
    @NotBlank(message = "Tiêu đề phòng không được để trống")
    @Length(max = 255, message = "Tiêu đề phòng không được vượt quá 255 ký tự")
    private String title;

    @NotBlank(message = "Biệt danh chủ phòng không được để trống")
    @Length(max = 64, message = "Biệt danh chủ phòng không được vượt quá 64 ký tự")
    private String hostNickname;

    @Builder.Default
    private Integer ttlHours = 24;

}
