package com.idncar.model.dto;

import lombok.Data;

@Data
public class SaveQrCodeRequest {

    private String title;
    private String description;
    private String shortCode;
    private String targetUrl;
    private String contentType;
    private String htmlContent;
    private String status;
    private Boolean loginRequired;
    private Boolean accessCodeRequired;
    private String accessCode;
    private String expiresAt;
}
