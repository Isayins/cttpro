package com.idncar.model.dto;

import lombok.Data;

@Data
public class CreatePostReportRequest {

    private String reason;
    private String detail;
}
