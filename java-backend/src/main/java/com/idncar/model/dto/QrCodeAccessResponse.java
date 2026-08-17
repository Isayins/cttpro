package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class QrCodeAccessResponse {

    private String contentType;
    private String targetUrl;
    private String htmlContent;
    private Long totalScanCount;
    private String message;
}
