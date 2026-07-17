package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.SiteVisitLogMapper;
import com.idncar.model.dto.DailyVisitStatDto;
import com.idncar.model.dto.PageVisitStatDto;
import com.idncar.model.dto.RecentVisitDto;
import com.idncar.model.dto.SiteAnalyticsOverviewDto;
import com.idncar.model.dto.TrackVisitRequest;
import com.idncar.model.entity.SiteVisitLog;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.sql.Date;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class SiteAnalyticsService {

    private static final int TOP_PAGES_LIMIT = 8;
    private static final int RECENT_VISITS_LIMIT = 12;
    private static final int DAILY_TREND_DAYS = 7;
    private static final SimpleDateFormat DATE_TIME_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private SiteVisitLogMapper siteVisitLogMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public void trackVisit(Long userId, TrackVisitRequest request, HttpServletRequest httpServletRequest) {
        if (request == null) {
            throw ApiException.badRequest("缺少访问数据");
        }

        SiteVisitLog visitLog = new SiteVisitLog();
        visitLog.setPath(limitText(requireText(request.getPath(), "访问路径不能为空"), 255));
        visitLog.setPageTitle(limitText(normalizeNullableText(request.getPageTitle()), 120));
        visitLog.setVisitorId(limitText(requireText(request.getVisitorId(), "访客标识不能为空"), 80));
        visitLog.setSessionId(limitText(requireText(request.getSessionId(), "会话标识不能为空"), 80));
        visitLog.setUserId(userId);
        visitLog.setReferrer(limitText(normalizeNullableText(request.getReferrer()), 500));

        String userAgent = normalizeNullableText(request.getUserAgent());
        if (userAgent == null) {
            userAgent = normalizeNullableText(httpServletRequest.getHeader("User-Agent"));
        }
        visitLog.setUserAgent(limitText(userAgent, 500));
        visitLog.setDeviceType(resolveDeviceType(request.getDeviceType(), userAgent));
        visitLog.setSource(resolveSource(request.getSource(), visitLog.getReferrer(), httpServletRequest));
        visitLog.setIpAddress(limitText(resolveClientIp(httpServletRequest), 120));

        siteVisitLogMapper.insert(visitLog);
    }

    public SiteAnalyticsOverviewDto getOverview(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);

        SiteAnalyticsOverviewDto overview = new SiteAnalyticsOverviewDto();
        overview.setTotalVisits(queryForLong("SELECT COUNT(*) FROM site_visit_logs"));
        overview.setUniqueVisitors(queryForLong("SELECT COUNT(DISTINCT visitor_id) FROM site_visit_logs"));
        overview.setTodayVisits(queryForLong("SELECT COUNT(*) FROM site_visit_logs WHERE DATE(create_time) = CURDATE()"));
        overview.setAuthenticatedVisits(queryForLong("SELECT COUNT(*) FROM site_visit_logs WHERE user_id IS NOT NULL"));
        overview.setTopPages(queryTopPages());
        overview.setDailyVisits(queryDailyVisits());
        overview.setRecentVisits(queryRecentVisits());
        return overview;
    }

    private List<PageVisitStatDto> queryTopPages() {
        return jdbcTemplate.query(
                """
                SELECT
                    path,
                    COALESCE(NULLIF(page_title, ''), path) AS title,
                    COUNT(*) AS visit_count
                FROM site_visit_logs
                GROUP BY path, COALESCE(NULLIF(page_title, ''), path)
                ORDER BY visit_count DESC, MAX(create_time) DESC
                LIMIT ?
                """,
                (rs, rowNum) -> {
                    PageVisitStatDto dto = new PageVisitStatDto();
                    dto.setPath(rs.getString("path"));
                    dto.setTitle(rs.getString("title"));
                    dto.setVisitCount(rs.getLong("visit_count"));
                    return dto;
                },
                TOP_PAGES_LIMIT
        );
    }

    private List<DailyVisitStatDto> queryDailyVisits() {
        Map<LocalDate, DailyVisitStatDto> visitMap = new LinkedHashMap<>();
        LocalDate startDate = LocalDate.now().minusDays(DAILY_TREND_DAYS - 1L);

        for (int i = 0; i < DAILY_TREND_DAYS; i++) {
            LocalDate currentDate = startDate.plusDays(i);
            DailyVisitStatDto dto = new DailyVisitStatDto();
            dto.setDate(currentDate.toString());
            dto.setVisitCount(0L);
            dto.setUniqueVisitors(0L);
            visitMap.put(currentDate, dto);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    DATE(create_time) AS visit_date,
                    COUNT(*) AS visit_count,
                    COUNT(DISTINCT visitor_id) AS unique_visitors
                FROM site_visit_logs
                WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(create_time)
                ORDER BY visit_date ASC
                """,
                DAILY_TREND_DAYS - 1
        );

        for (Map<String, Object> row : rows) {
            Date visitDate = (Date) row.get("visit_date");
            if (visitDate == null) {
                continue;
            }

            LocalDate localDate = visitDate.toLocalDate();
            DailyVisitStatDto dto = visitMap.get(localDate);
            if (dto == null) {
                continue;
            }

            dto.setVisitCount(toLong(row.get("visit_count")));
            dto.setUniqueVisitors(toLong(row.get("unique_visitors")));
        }

        return new ArrayList<>(visitMap.values());
    }

    private List<RecentVisitDto> queryRecentVisits() {
        return jdbcTemplate.query(
                """
                SELECT
                    l.path,
                    COALESCE(NULLIF(l.page_title, ''), l.path) AS title,
                    l.visitor_id,
                    u.nickname,
                    l.device_type,
                    l.source,
                    l.create_time
                FROM site_visit_logs l
                LEFT JOIN users u ON l.user_id = u.id
                ORDER BY l.create_time DESC, l.id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> {
                    RecentVisitDto dto = new RecentVisitDto();
                    dto.setPath(rs.getString("path"));
                    dto.setTitle(rs.getString("title"));
                    dto.setVisitorId(maskVisitorId(rs.getString("visitor_id")));
                    dto.setNickname(rs.getString("nickname"));
                    dto.setDeviceType(normalizeDisplayValue(rs.getString("device_type")));
                    dto.setSource(normalizeDisplayValue(rs.getString("source")));
                    dto.setCreateTime(formatDateTime(rs.getTimestamp("create_time")));
                    return dto;
                },
                RECENT_VISITS_LIMIT
        );
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = normalizeNullableText(request.getHeader("X-Forwarded-For"));
        if (forwarded != null) {
            return forwarded.split(",")[0].trim();
        }

        String realIp = normalizeNullableText(request.getHeader("X-Real-IP"));
        if (realIp != null) {
            return realIp;
        }

        return normalizeNullableText(request.getRemoteAddr());
    }

    private String resolveSource(String preferredSource, String referrer, HttpServletRequest request) {
        String source = normalizeNullableText(preferredSource);
        if (source != null && List.of("direct", "internal").contains(source.toLowerCase(Locale.ROOT))) {
            return source.toLowerCase(Locale.ROOT);
        }

        if (referrer == null) {
            return "direct";
        }

        try {
            URI referrerUri = URI.create(referrer);
            String referrerHost = normalizeNullableText(referrerUri.getHost());
            String currentHost = normalizeNullableText(request.getServerName());
            if (referrerHost == null) {
                return "direct";
            }
            if (currentHost != null && referrerHost.equalsIgnoreCase(currentHost)) {
                return "internal";
            }
            return limitText(referrerHost, 120);
        } catch (Exception ignored) {
            return "direct";
        }
    }

    private String resolveDeviceType(String preferredDeviceType, String userAgent) {
        String deviceType = normalizeNullableText(preferredDeviceType);
        if (deviceType != null) {
            return limitText(deviceType.toUpperCase(Locale.ROOT), 30);
        }

        String ua = userAgent == null ? "" : userAgent.toLowerCase(Locale.ROOT);
        if (ua.contains("bot") || ua.contains("spider") || ua.contains("crawler")) {
            return "BOT";
        }
        if (ua.contains("ipad") || ua.contains("tablet")) {
            return "TABLET";
        }
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            return "MOBILE";
        }
        return "DESKTOP";
    }

    private long queryForLong(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private String maskVisitorId(String visitorId) {
        if (visitorId == null || visitorId.length() <= 8) {
            return visitorId;
        }
        return visitorId.substring(0, 4) + "..." + visitorId.substring(visitorId.length() - 4);
    }

    private String normalizeDisplayValue(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String formatDateTime(java.util.Date date) {
        if (date == null) {
            return null;
        }
        synchronized (DATE_TIME_FORMAT) {
            return DATE_TIME_FORMAT.format(date);
        }
    }

    private long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return 0L;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest(message);
        }
        return normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
