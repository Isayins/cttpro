package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class QrCodeAccessResponse {

    private String targetUrl;
    private String message;
}
