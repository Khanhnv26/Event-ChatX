package com.eventchat.modules.room.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.eventchat.common.json.StrictIntegerDeserializer;
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

    @Min(value = 5, message = "Thời hạn tối thiểu là 5 phút")
    @Max(value = 10080, message = "Thời hạn tối đa là 7 ngày")
    @JsonDeserialize(using = StrictIntegerDeserializer.class)
    private Integer ttlMinutes;

    @Min(value = 1, message = "Thời hạn theo giờ tối thiểu là 1 giờ")
    @Max(value = 168, message = "Thời hạn tối đa là 7 ngày")
    @JsonDeserialize(using = StrictIntegerDeserializer.class)
    private Integer ttlHours;

}
