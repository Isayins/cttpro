package com.idncar.model.dto;

import lombok.Data;

@Data
public class QrCodeAccessRequest {

    private String accessId;
    private String accessCode;
    private String visitorId;
    private String sessionId;
    private String source;
    private String userAgent;
    private String deviceType;
}
