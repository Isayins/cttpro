package com.idncar.model.dto;

public record VerifyDownloadCaptchaResponse(
        Boolean ok,
        String downloadToken,
        String message
) {
}
