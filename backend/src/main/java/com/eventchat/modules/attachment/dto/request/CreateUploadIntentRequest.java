package com.eventchat.modules.attachment.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateUploadIntentRequest {

    @NotBlank(message = "Client upload ID không được để trống")
    @Pattern(
            regexp = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            message = "Client upload ID phải là UUID viết thường"
    )
    private String clientUploadId;

    @NotBlank(message = "File name không được để trống")
    @Size(max = 255, message = "File name không được vượt quá 255 ký tự")
    private String filename;

    @NotBlank(message = "Declared content type không được để trống")
    @Size(max = 127, message = "Declared content type không được vượt quá 127 ký tự")
    private String declaredContentType;

    @NotNull(message = "Size bytes không được để trống")
    @Positive(message = "Size bytes phải là số dương")
    private Long sizeBytes;
}
