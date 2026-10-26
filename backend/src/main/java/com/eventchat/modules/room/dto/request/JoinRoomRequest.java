package com.eventchat.modules.room.dto.request;


import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.validator.constraints.Length;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class JoinRoomRequest {
    @NotBlank(message = "Biệt danh không được để trống")
    @Length(max = 64, message = "Biệt danh không được vượt quá 64 ký tự")
    private String nickname;
}
