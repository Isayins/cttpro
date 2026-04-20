package com.idncar.api.admin;

import com.idncar.model.dto.SiteAnalyticsOverviewDto;
import com.idncar.service.SiteAnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {

    @Autowired
    private SiteAnalyticsService siteAnalyticsService;

    @GetMapping("/overview")
    public ResponseEntity<SiteAnalyticsOverviewDto> getOverview(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(siteAnalyticsService.getOverview(userId));
    }
}
