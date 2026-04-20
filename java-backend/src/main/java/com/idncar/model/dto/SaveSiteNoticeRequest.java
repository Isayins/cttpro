package com.idncar.model.dto;

import lombok.Data;

@Data
public class SaveSiteNoticeRequest {

    private String title;
    private String content;
    private Boolean published;
    private Integer sortOrder;
}
