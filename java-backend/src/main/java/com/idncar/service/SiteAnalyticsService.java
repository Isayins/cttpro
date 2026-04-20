package com.idncar.service;

import com.idncar.model.dto.SiteAnalyticsOverviewDto;
import com.idncar.model.dto.TrackVisitRequest;
import jakarta.servlet.http.HttpServletRequest;

public interface SiteAnalyticsService {

    void trackVisit(Long userId, TrackVisitRequest request, HttpServletRequest httpServletRequest);

    SiteAnalyticsOverviewDto getOverview(Long adminUserId);
}
