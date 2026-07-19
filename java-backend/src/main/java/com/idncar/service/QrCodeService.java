package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.QrCodeMapper;
import com.idncar.mapper.QrScanLogMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.QrCodeAccessRequest;
import com.idncar.model.dto.QrCodeAccessResponse;
import com.idncar.model.dto.QrCodeDto;
import com.idncar.model.dto.QrCodePublicDto;
import com.idncar.model.dto.QrScanLogDto;
import com.idncar.model.dto.SaveQrCodeRequest;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.QrCode;
import com.idncar.model.entity.QrScanLog;
import com.idncar.model.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class QrCodeService {

    private static final Pattern SHORT_CODE_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{4,24}$");
    private static final List<DateTimeFormatter> DATE_TIME_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    );

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private QrCodeMapper qrCodeMapper;

    @Autowired
    private QrScanLogMapper qrScanLogMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<QrCodeDto> getAdminQrCodes(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        List<QrCode> qrCodes = qrCodeMapper.selectList(new QueryWrapper<QrCode>().orderByDesc("create_time"));
        Map<Long, Map<String, Object>> statMap = queryQrStats(qrCodes.stream().map(QrCode::getId).collect(Collectors.toList()));
        return qrCodes.stream()
                .map(item -> toQrCodeDto(item, statMap.get(item.getId())))
                .collect(Collectors.toList());
    }

    public QrCodeDto createQrCode(Long adminUserId, SaveQrCodeRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        QrCode qrCode = new QrCode();
        fillQrCode(qrCode, request);
        qrCode.setCreatedBy(operator.getId());
        qrCodeMapper.insert(qrCode);
        logOperation(operator, "QR_CREATED", qrCode.getId(), qrCode.getTitle(), "新增动态二维码");
        return toQrCodeDto(qrCodeMapper.selectById(qrCode.getId()), null);
    }

    public QrCodeDto updateQrCode(Long adminUserId, Long qrCodeId, SaveQrCodeRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        QrCode qrCode = requireQrCodeById(qrCodeId);
        fillQrCode(qrCode, request);
        qrCodeMapper.updateById(qrCode);
        logOperation(operator, "QR_UPDATED", qrCode.getId(), qrCode.getTitle(), "更新动态二维码");
        Map<Long, Map<String, Object>> statMap = queryQrStats(List.of(qrCode.getId()));
        return toQrCodeDto(qrCodeMapper.selectById(qrCode.getId()), statMap.get(qrCode.getId()));
    }

    public void deleteQrCode(Long adminUserId, Long qrCodeId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        QrCode qrCode = requireQrCodeById(qrCodeId);
        qrCodeMapper.deleteById(qrCodeId);
        logOperation(operator, "QR_DELETED", qrCode.getId(), qrCode.getTitle(), "删除动态二维码");
    }

    public List<QrScanLogDto> getRecentScanLogs(Long adminUserId, Long qrCodeId, Integer limit) {
        userAccessService.requireAdmin(adminUserId);
        requireQrCodeById(qrCodeId);
        int safeLimit = limit == null ? 20 : Math.max(1, Math.min(limit, 100));
        List<QrScanLog> scanLogs = qrScanLogMapper.selectList(new QueryWrapper<QrScanLog>()
                .eq("qr_code_id", qrCodeId)
                .orderByDesc("create_time")
                .last("LIMIT " + safeLimit));
        return toScanDtos(scanLogs);
    }

    public QrCodePublicDto getPublicQrCode(String shortCode, Long currentUserId) {
        QrCode qrCode = requireQrCodeByShortCode(shortCode);
        return QrCodePublicDto.fromEntity(
                qrCode,
                canAccess(qrCode, currentUserId, false, null),
                unavailableReason(qrCode, currentUserId, false, null)
        );
    }

    public QrCodeAccessResponse accessQrCode(String shortCode,
                                            QrCodeAccessRequest request,
                                            Long currentUserId,
                                            HttpServletRequest httpServletRequest) {
        QrCode qrCode = requireQrCodeByShortCode(shortCode);
        QrCodeAccessRequest safeRequest = request == null ? new QrCodeAccessRequest() : request;

        String reason = unavailableReason(qrCode, currentUserId, true, safeRequest.getAccessCode());
        if (reason != null) {
            throw ApiException.forbidden(reason);
        }

        QrScanLog scanLog = new QrScanLog();
        scanLog.setQrCodeId(qrCode.getId());
        scanLog.setUserId(currentUserId);
        scanLog.setVisitorId(limitText(normalizeNullableText(safeRequest.getVisitorId()), 80));
        scanLog.setSessionId(limitText(normalizeNullableText(safeRequest.getSessionId()), 80));
        scanLog.setSource(resolveSource(normalizeNullableText(safeRequest.getSource()), httpServletRequest));
        scanLog.setUserAgent(limitText(resolveUserAgent(normalizeNullableText(safeRequest.getUserAgent()), httpServletRequest), 500));
        scanLog.setDeviceType(resolveDeviceType(normalizeNullableText(safeRequest.getDeviceType()), scanLog.getUserAgent()));
        scanLog.setIpAddress(limitText(resolveClientIp(httpServletRequest), 120));
        qrScanLogMapper.insert(scanLog);

        return new QrCodeAccessResponse(qrCode.getTargetUrl(), "二维码访问成功");
    }

    private void fillQrCode(QrCode qrCode, SaveQrCodeRequest request) {
        if (request == null) {
            throw ApiException.badRequest("缺少二维码数据");
        }
        qrCode.setTitle(limitText(requireText(request.getTitle(), "请输入二维码标题"), 80));
        qrCode.setDescription(limitText(normalizeNullableText(request.getDescription()), 255));
        qrCode.setShortCode(resolveShortCode(qrCode.getId(), request.getShortCode()));
        qrCode.setTargetUrl(validateTargetUrl(request.getTargetUrl()));
        qrCode.setStatus(resolveStatus(request.getStatus()));
        qrCode.setLoginRequired(Boolean.TRUE.equals(request.getLoginRequired()));
        qrCode.setAccessCodeRequired(Boolean.TRUE.equals(request.getAccessCodeRequired()));
        qrCode.setAccessCode(resolveAccessCode(request.getAccessCodeRequired(), request.getAccessCode(), qrCode.getAccessCode()));
        qrCode.setExpiresAt(parseDateTime(request.getExpiresAt()));
    }

    private QrCode requireQrCodeById(Long qrCodeId) {
        QrCode qrCode = qrCodeMapper.selectById(qrCodeId);
        if (qrCode == null) {
            throw ApiException.notFound("二维码不存在");
        }
        return qrCode;
    }

    private QrCode requireQrCodeByShortCode(String shortCode) {
        String normalized = requireText(shortCode, "二维码短码不能为空");
        QrCode qrCode = qrCodeMapper.selectOne(new QueryWrapper<QrCode>().eq("short_code", normalized).last("LIMIT 1"));
        if (qrCode == null) {
            throw ApiException.notFound("二维码不存在或已失效");
        }
        return qrCode;
    }

    private String resolveShortCode(Long qrCodeId, String shortCode) {
        String normalized = normalizeNullableText(shortCode);
        if (normalized == null) {
            normalized = generateShortCode();
        }
        if (!SHORT_CODE_PATTERN.matcher(normalized).matches()) {
            throw ApiException.badRequest("短码仅支持 4 到 24 位字母、数字、下划线或短横线");
        }

        QrCode existing = qrCodeMapper.selectOne(new QueryWrapper<QrCode>().eq("short_code", normalized).last("LIMIT 1"));
        if (existing != null && (qrCodeId == null || !existing.getId().equals(qrCodeId))) {
            throw ApiException.badRequest("该短码已被占用，请更换一个");
        }
        return normalized;
    }

    private String generateShortCode() {
        for (int i = 0; i < 10; i++) {
            String shortCode = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            Long count = qrCodeMapper.selectCount(new QueryWrapper<QrCode>().eq("short_code", shortCode));
            if (count == null || count == 0) {
                return shortCode;
            }
        }
        throw ApiException.badRequest("短码生成失败，请稍后再试");
    }

    private String validateTargetUrl(String targetUrl) {
        String normalized = requireText(targetUrl, "请输入目标链接");
        if (normalized.startsWith("/")) {
            return normalized;
        }
        try {
            URI uri = URI.create(normalized);
            String scheme = normalizeNullableText(uri.getScheme());
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                throw ApiException.badRequest("目标链接仅支持 http、https 或站内相对路径");
            }
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw ApiException.badRequest("目标链接格式不正确");
        }
    }

    private String resolveStatus(String status) {
        String normalized = normalizeNullableText(status);
        if (normalized == null) {
            return "ACTIVE";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "DISABLED").contains(upper)) {
            throw ApiException.badRequest("二维码状态仅支持 ACTIVE 或 DISABLED");
        }
        return upper;
    }

    private String resolveAccessCode(Boolean accessCodeRequired, String newAccessCode, String existingAccessCode) {
        if (!Boolean.TRUE.equals(accessCodeRequired)) {
            return null;
        }
        String normalized = normalizeNullableText(newAccessCode);
        if (normalized == null) {
            if (existingAccessCode != null && !existingAccessCode.isBlank()) {
                return existingAccessCode;
            }
            throw ApiException.badRequest("开启验证码访问后，请填写访问验证码");
        }
        if (normalized.length() < 4 || normalized.length() > 20) {
            throw ApiException.badRequest("访问验证码长度需要在 4 到 20 位之间");
        }
        return normalized;
    }

    private Date parseDateTime(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            return null;
        }
        for (DateTimeFormatter formatter : DATE_TIME_FORMATTERS) {
            try {
                LocalDateTime localDateTime = LocalDateTime.parse(normalized, formatter);
                return Date.from(localDateTime.atZone(ZoneId.systemDefault()).toInstant());
            } catch (DateTimeParseException ignored) {
                // try next formatter
            }
        }
        throw ApiException.badRequest("过期时间格式不正确，请使用 yyyy-MM-dd HH:mm:ss");
    }

    private boolean canAccess(QrCode qrCode, Long currentUserId, boolean checkCode, String accessCode) {
        return unavailableReason(qrCode, currentUserId, checkCode, accessCode) == null;
    }

    private String unavailableReason(QrCode qrCode, Long currentUserId, boolean checkCode, String accessCode) {
        if (!"ACTIVE".equalsIgnoreCase(qrCode.getStatus())) {
            return "该二维码已停用";
        }
        if (qrCode.getExpiresAt() != null && qrCode.getExpiresAt().before(new Date())) {
            return "该二维码已过期";
        }
        if (Boolean.TRUE.equals(qrCode.getLoginRequired()) && currentUserId == null) {
            return "该二维码需要登录后访问";
        }
        if (Boolean.TRUE.equals(qrCode.getAccessCodeRequired())) {
            if (!checkCode) {
                return "该二维码需要输入访问验证码";
            }
            if (normalizeNullableText(accessCode) == null || !qrCode.getAccessCode().equals(accessCode.trim())) {
                return "访问验证码不正确";
            }
        }
        return null;
    }

    private QrCodeDto toQrCodeDto(QrCode qrCode, Map<String, Object> stats) {
        long scanCount = stats == null ? 0L : toLong(stats.get("scan_count"));
        long todayScanCount = stats == null ? 0L : toLong(stats.get("today_scan_count"));
        Date lastScanTime = null;
        Object lastScanValue = stats == null ? null : stats.get("last_scan_time");
        if (lastScanValue instanceof Date date) {
            lastScanTime = date;
        }
        return QrCodeDto.fromEntity(qrCode, scanCount, todayScanCount, lastScanTime);
    }

    private Map<Long, Map<String, Object>> queryQrStats(List<Long> qrCodeIds) {
        if (qrCodeIds == null || qrCodeIds.isEmpty()) {
            return Collections.emptyMap();
        }
        String placeholders = qrCodeIds.stream().map(id -> "?").collect(Collectors.joining(","));
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    qr_code_id,
                    COUNT(*) AS scan_count,
                    SUM(CASE WHEN DATE(create_time) = CURDATE() THEN 1 ELSE 0 END) AS today_scan_count,
                    MAX(create_time) AS last_scan_time
                FROM qr_scan_logs
                WHERE qr_code_id IN (%s)
                  AND create_time >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
                GROUP BY qr_code_id
                """.formatted(placeholders),
                qrCodeIds.toArray()
        );
        return rows.stream().collect(Collectors.toMap(
                row -> ((Number) row.get("qr_code_id")).longValue(),
                Function.identity()
        ));
    }

    private List<QrScanLogDto> toScanDtos(List<QrScanLog> scanLogs) {
        List<Long> userIds = scanLogs.stream()
                .map(QrScanLog::getUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> users = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return scanLogs.stream()
                .map(item -> QrScanLogDto.fromEntity(item, users.get(item.getUserId())))
                .collect(Collectors.toList());
    }

    private void logOperation(User operator, String actionType, Long qrCodeId, String qrTitle, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("QR_CODE");
        log.setTargetId(qrCodeId);
        log.setTargetName(limitText(normalizeNullableText(qrTitle), 160));
        log.setDetail(limitText(normalizeNullableText(detail), 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
    }

    private String resolveSource(String source, HttpServletRequest request) {
        if (source != null) {
            return limitText(source, 120);
        }
        String referrer = normalizeNullableText(request.getHeader("Referer"));
        if (referrer == null) {
            return "direct";
        }
        try {
            URI uri = URI.create(referrer);
            String host = normalizeNullableText(uri.getHost());
            return limitText(host == null ? "direct" : host, 120);
        } catch (Exception ignored) {
            return "direct";
        }
    }

    private String resolveUserAgent(String preferredUserAgent, HttpServletRequest request) {
        return preferredUserAgent == null ? normalizeNullableText(request.getHeader("User-Agent")) : preferredUserAgent;
    }

    private String resolveDeviceType(String preferredDeviceType, String userAgent) {
        if (preferredDeviceType != null) {
            return limitText(preferredDeviceType.toUpperCase(Locale.ROOT), 30);
        }
        String ua = userAgent == null ? "" : userAgent.toLowerCase(Locale.ROOT);
        if (ua.contains("ipad") || ua.contains("tablet")) {
            return "TABLET";
        }
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            return "MOBILE";
        }
        return "DESKTOP";
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

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
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
