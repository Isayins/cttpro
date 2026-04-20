package com.idncar.model.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SiteAnalyticsOverviewDto {

    private Long totalVisits;
    private Long uniqueVisitors;
    private Long todayVisits;
    private Long authenticatedVisits;
    private List<PageVisitStatDto> topPages = new ArrayList<>();
    private List<DailyVisitStatDto> dailyVisits = new ArrayList<>();
    private List<RecentVisitDto> recentVisits = new ArrayList<>();
}
