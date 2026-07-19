package com.idncar.model.dto;

import lombok.Data;

@Data
public class ReviewPostReportRequest {

    private String status;
    private String reviewNote;
    private Boolean deleteTarget;
}
