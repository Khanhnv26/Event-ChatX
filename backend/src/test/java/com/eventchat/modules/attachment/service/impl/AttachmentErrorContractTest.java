package com.eventchat.modules.attachment.service.impl;

import com.eventchat.common.exception.AttachmentConflictException;
import com.eventchat.common.exception.AttachmentQuotaExceededException;
import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.common.exception.UnsupportedAttachmentTypeException;
import com.eventchat.common.exception.UploadTooLargeException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AttachmentErrorContractTest {
    @ParameterizedTest
    @CsvSource({"quota,409", "conflict,409", "type,415", "size,413"})
    void mapsAttachmentFailuresToTheExpectedHttpStatus(String kind, int expectedStatus) throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new FailureController())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/attachment-errors/" + kind))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.success").value(false));
    }

    @RestController
    static class FailureController {
        @GetMapping("/attachment-errors/{kind}")
        void fail(@PathVariable String kind) {
            switch (kind) {
                case "quota" -> throw new AttachmentQuotaExceededException();
                case "conflict" -> throw new AttachmentConflictException("Intent đã hết hạn");
                case "type" -> throw new UnsupportedAttachmentTypeException();
                case "size" -> throw new UploadTooLargeException(1024L);
                default -> throw new IllegalArgumentException("Unknown test failure");
            }
        }
    }
}
