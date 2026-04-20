package com.idncar.model.dto;

public record VerifyDownloadCaptchaRequest(
        String captchaId,
        String answer,
        String resource,
        String fileName
) {
}
