package com.idncar.model.dto;

import lombok.Data;

@Data
public class PageVisitStatDto {

    private String path;
    private String title;
    private Long visitCount;
}
