package com.idncar.model.dto;

import lombok.Data;

@Data
public class DailyVisitStatDto {

    private String date;
    private Long visitCount;
    private Long uniqueVisitors;
}
