package com.idncar.model.dto;

import lombok.Data;

@Data
public class ToolDiagnosticsResponse {

    private String requestId;

    private Long userId;

    private Long serverTimeMillis;

    private String serverTimeIso;

    private String serverZone;

    private String javaVersion;

    private String remoteAddr;

    private String forwardedFor;

    private String method;

    private String path;

    private String userAgent;
}
