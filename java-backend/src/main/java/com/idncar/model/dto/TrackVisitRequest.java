package com.idncar.model.dto;

import lombok.Data;

@Data
public class TrackVisitRequest {

    private String path;
    private String pageTitle;
    private String visitorId;
    private String sessionId;
    private String referrer;
    private String source;
    private String userAgent;
    private String deviceType;
}
