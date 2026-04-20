package com.idncar.api.common;

import com.idncar.model.dto.TrackVisitRequest;
import com.idncar.service.SiteAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @Autowired
    private SiteAnalyticsService siteAnalyticsService;

    @PostMapping("/visit")
    public ResponseEntity<Map<String, String>> trackVisit(
            @RequestAttribute(value = "userId", required = false) Long userId,
            @RequestBody TrackVisitRequest request,
            HttpServletRequest httpServletRequest
    ) {
        siteAnalyticsService.trackVisit(userId, request, httpServletRequest);
        return ResponseEntity.ok(Map.of("message", "访问记录成功"));
    }
}
