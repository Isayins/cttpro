package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SendEmailCodeResponse {

    private String message;
    private String debugCode;
}
