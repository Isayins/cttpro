package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.PaymentVmqSettingMapper;
import com.idncar.model.dto.SaveVmqPaymentSettingsRequest;
import com.idncar.model.dto.VmqPaymentSettingsDto;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.PaymentVmqSetting;
import com.idncar.model.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

@Service
public class InternalVmqPaymentService {

    public record VmqMonitorHealth(boolean enabled, String state, Date lastHeartTime) {
    }

    public record VmqOrderDraft(int payType, String payUrl, BigDecimal reallyPrice, Date expireTime) {
    }

    public record VmqApiResponse(int code, String msg, Object data) {

        public static VmqApiResponse success() {
            return new VmqApiResponse(1, "成功", null);
        }

        public static VmqApiResponse success(Object data) {
            return new VmqApiResponse(1, "成功", data);
        }

        public static VmqApiResponse failure(String message) {
            return new VmqApiResponse(-1, message, null);
        }
    }

    private static final long SETTING_ID = 1L;
    private static final String STATUS_CREATED = "CREATED";
    private static final String STATUS_WAIT_BUYER_PAY = "WAIT_BUYER_PAY";
    private static final String STRATEGY_INCREASE = "INCREASE";
    private static final String STRATEGY_DECREASE = "DECREASE";
    private static final String MONITOR_UNBOUND = "UNBOUND";
    private static final String MONITOR_ONLINE = "ONLINE";
    private static final String MONITOR_OFFLINE = "OFFLINE";
    private static final BigDecimal CENT = new BigDecimal("0.01");
    private static final BigDecimal MIN_AMOUNT = new BigDecimal("0.01");
    private static final long APP_PUSH_SIGNATURE_MAX_AGE_SECONDS = 300L;
    private static final long APP_PUSH_EVENT_MAX_AGE_SECONDS = 86400L;
    private static final long APP_PUSH_CLOCK_SKEW_SECONDS = 120L;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired
    private PaymentVmqSettingMapper paymentVmqSettingMapper;

    @Autowired
    private PaymentOrderMapper paymentOrderMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Value("${app.site.base-url:}")
    private String siteBaseUrl;

    public VmqPaymentSettingsDto getAdminSettings(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        PaymentVmqSetting setting = refreshMonitorState(getOrCreateSetting());
        return VmqPaymentSettingsDto.fromEntity(setting, normalizedMonitorBaseUrl());
    }

    public VmqMonitorHealth getMonitorHealth() {
        PaymentVmqSetting setting = refreshMonitorState(getOrCreateSetting());
        return new VmqMonitorHealth(
                Boolean.TRUE.equals(setting.getEnabled()),
                setting.getMonitorState(),
                setting.getLastHeartTime()
        );
    }

    public VmqPaymentSettingsDto saveAdminSettings(Long adminUserId, SaveVmqPaymentSettingsRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        if (request == null) {
            throw ApiException.badRequest("缺少 V免签配置");
        }

        PaymentVmqSetting setting = getOrCreateSetting();
        setting.setEnabled(Boolean.TRUE.equals(request.getEnabled()));
        setting.setPreferred(request.getPreferred() == null || Boolean.TRUE.equals(request.getPreferred()));
        setting.setPayType(normalizePayType(request.getPayType()));
        setting.setCommunicationKey(normalizeCommunicationKey(firstText(request.getCommunicationKey(), setting.getCommunicationKey())));
        setting.setWxPayUrl(limitText(normalizeNullableText(request.getWxPayUrl()), 512));
        setting.setAlipayPayUrl(limitText(normalizeNullableText(request.getAlipayPayUrl()), 512));
        setting.setAmountStrategy(normalizeAmountStrategy(request.getAmountStrategy()));
        setting.setOrderTimeoutMinutes(normalizeTimeoutMinutes(request.getOrderTimeoutMinutes()));
        if (Boolean.TRUE.equals(setting.getEnabled()) && normalizeNullableText(selectedPayUrl(setting)) == null) {
            throw ApiException.badRequest(setting.getPayType() == 1 ? "请先填写微信收款码内容" : "请先填写支付宝收款码内容");
        }

        setting.setUpdateTime(new Date());
        paymentVmqSettingMapper.updateById(setting);
        PaymentVmqSetting saved = refreshMonitorState(paymentVmqSettingMapper.selectById(SETTING_ID));
        logOperation(operator, "VMQ_SETTING_UPDATED", "更新 V免签配置");
        return VmqPaymentSettingsDto.fromEntity(saved, normalizedMonitorBaseUrl());
    }

    public VmqPaymentSettingsDto regenerateCommunicationKey(Long adminUserId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentVmqSetting setting = getOrCreateSetting();
        setting.setCommunicationKey(generateCommunicationKey());
        setting.setUpdateTime(new Date());
        paymentVmqSettingMapper.updateById(setting);
        PaymentVmqSetting saved = refreshMonitorState(paymentVmqSettingMapper.selectById(SETTING_ID));
        logOperation(operator, "VMQ_KEY_REGENERATED", "重新生成 V免签通讯密钥");
        return VmqPaymentSettingsDto.fromEntity(saved, normalizedMonitorBaseUrl());
    }

    public synchronized PaymentVmqSetting getOrCreateSetting() {
        PaymentVmqSetting setting = paymentVmqSettingMapper.selectById(SETTING_ID);
        if (setting != null) {
            return normalizeStoredSetting(setting);
        }

        PaymentVmqSetting created = new PaymentVmqSetting();
        created.setId(SETTING_ID);
        created.setEnabled(false);
        created.setPreferred(true);
        created.setPayType(2);
        created.setCommunicationKey(generateCommunicationKey());
        created.setAmountStrategy(STRATEGY_INCREASE);
        created.setOrderTimeoutMinutes(5);
        created.setMonitorState(MONITOR_UNBOUND);
        Date now = new Date();
        created.setCreateTime(now);
        created.setUpdateTime(now);
        paymentVmqSettingMapper.insert(created);
        return created;
    }

    public boolean isEnabled() {
        return Boolean.TRUE.equals(getOrCreateSetting().getEnabled());
    }

    public boolean isConfigured() {
        PaymentVmqSetting setting = getOrCreateSetting();
        return Boolean.TRUE.equals(setting.getEnabled())
                && normalizeNullableText(setting.getCommunicationKey()) != null
                && (setting.getPayType() != null && (setting.getPayType() == 1 || setting.getPayType() == 2))
                && normalizeNullableText(selectedPayUrl(setting)) != null;
    }

    public boolean isPreferred() {
        return Boolean.TRUE.equals(getOrCreateSetting().getPreferred());
    }

    public String resolveChannelCode() {
        return channelForPayType(getOrCreateSetting().getPayType());
    }

    public synchronized VmqOrderDraft createOrderDraft(PaymentOrder order) {
        PaymentVmqSetting setting = requirePaymentSetting();
        BigDecimal requestedAmount = requireOrderAmount(order);
        BigDecimal reallyPrice = allocateUniqueAmount(setting, order.getId(), requestedAmount);
        Date expireTime = Date.from(Instant.now().plus(Duration.ofMinutes(normalizeTimeoutMinutes(setting.getOrderTimeoutMinutes()))));
        order.setTotalAmount(reallyPrice);
        order.setExpireTime(expireTime);
        paymentOrderMapper.updateById(order);
        return new VmqOrderDraft(setting.getPayType(), selectedPayUrl(setting), reallyPrice, expireTime);
    }

    public boolean verifyNotify(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return false;
        }
        PaymentVmqSetting setting = getOrCreateSetting();
        String key = normalizeNullableText(setting.getCommunicationKey());
        String payId = normalizeNullableText(params.get("payId"));
        String param = params.get("param") == null ? "" : params.get("param");
        String type = normalizeNullableText(params.get("type"));
        String price = normalizeNullableText(params.get("price"));
        String reallyPrice = normalizeNullableText(params.get("reallyPrice"));
        String sign = normalizeNullableText(params.get("sign"));
        if (key == null || payId == null || type == null || price == null || reallyPrice == null || sign == null) {
            return false;
        }
        return sign.equalsIgnoreCase(md5(payId + param + type + price + reallyPrice + key));
    }

    public boolean verifyAppPush(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return false;
        }
        PaymentVmqSetting setting = getOrCreateSetting();
        String key = normalizeNullableText(setting.getCommunicationKey());
        String type = normalizeNullableText(params.get("type"));
        String price = normalizeNullableText(params.get("price"));
        String paidAt = normalizeNullableText(params.get("paidAt"));
        String eventId = normalizeNullableText(params.get("eventId"));
        String mode = normalizeNullableText(params.get("mode"));
        String t = normalizeNullableText(params.get("t"));
        String sign = normalizeNullableText(params.get("sign"));
        if (key == null || type == null || price == null || paidAt == null || eventId == null
                || mode == null || t == null || sign == null) {
            return false;
        }
        mode = mode.toUpperCase(Locale.ROOT);
        if (!"LIVE".equals(mode) && !"TEST".equals(mode)) {
            return false;
        }
        if (!eventId.matches("^[a-fA-F0-9]{64}$")) {
            return false;
        }
        Long requestEpoch = parseEpochSecond(t);
        Long paidEpoch = parseEpochSecond(paidAt);
        if (requestEpoch == null || paidEpoch == null) {
            return false;
        }
        long now = Instant.now().getEpochSecond();
        if (Math.abs(now - requestEpoch) > APP_PUSH_SIGNATURE_MAX_AGE_SECONDS) {
            return false;
        }
        if (paidEpoch > now + APP_PUSH_CLOCK_SKEW_SECONDS
                || paidEpoch < now - APP_PUSH_EVENT_MAX_AGE_SECONDS) {
            return false;
        }
        return sign.equalsIgnoreCase(md5(type + price + paidAt + eventId + mode + t + key));
    }

    public void recordAppPush() {
        PaymentVmqSetting setting = getOrCreateSetting();
        setting.setLastPayTime(new Date());
        setting.setMonitorState(MONITOR_ONLINE);
        setting.setUpdateTime(new Date());
        paymentVmqSettingMapper.updateById(setting);
    }

    public VmqApiResponse getState(Map<String, String> params) {
        if (!verifyHeartSign(params)) {
            return VmqApiResponse.failure("签名校验不通过");
        }
        PaymentVmqSetting setting = refreshMonitorState(getOrCreateSetting());
        return VmqApiResponse.success(Map.of(
                "lastheart", epochSeconds(setting.getLastHeartTime()),
                "lastpay", epochSeconds(setting.getLastPayTime()),
                "jkstate", MONITOR_ONLINE.equals(setting.getMonitorState()) ? 1 : 0
        ));
    }

    public VmqApiResponse appHeart(Map<String, String> params) {
        if (!verifyHeartSign(params)) {
            return VmqApiResponse.failure("签名校验不通过");
        }
        PaymentVmqSetting setting = getOrCreateSetting();
        Date now = new Date();
        setting.setLastHeartTime(now);
        setting.setMonitorState(MONITOR_ONLINE);
        setting.setUpdateTime(now);
        paymentVmqSettingMapper.updateById(setting);
        return VmqApiResponse.success();
    }

    private PaymentVmqSetting requirePaymentSetting() {
        PaymentVmqSetting setting = getOrCreateSetting();
        if (!Boolean.TRUE.equals(setting.getEnabled())) {
            throw ApiException.badRequest("V免签未启用，请先在后台开启");
        }
        if (normalizeNullableText(setting.getCommunicationKey()) == null) {
            throw ApiException.badRequest("V免签通讯密钥缺失，请先在后台生成");
        }
        if (normalizeNullableText(selectedPayUrl(setting)) == null) {
            throw ApiException.badRequest(setting.getPayType() == 1 ? "请先配置微信收款码" : "请先配置支付宝收款码");
        }
        return setting;
    }

    private PaymentVmqSetting normalizeStoredSetting(PaymentVmqSetting setting) {
        boolean changed = false;
        if (setting.getCommunicationKey() == null || setting.getCommunicationKey().isBlank()) {
            setting.setCommunicationKey(generateCommunicationKey());
            changed = true;
        }
        if (setting.getPreferred() == null) {
            setting.setPreferred(true);
            changed = true;
        }
        if (setting.getPayType() == null || (setting.getPayType() != 1 && setting.getPayType() != 2)) {
            setting.setPayType(2);
            changed = true;
        }
        if (normalizeNullableText(setting.getAmountStrategy()) == null) {
            setting.setAmountStrategy(STRATEGY_INCREASE);
            changed = true;
        }
        if (setting.getOrderTimeoutMinutes() == null || setting.getOrderTimeoutMinutes() <= 0) {
            setting.setOrderTimeoutMinutes(5);
            changed = true;
        }
        if (normalizeNullableText(setting.getMonitorState()) == null) {
            setting.setMonitorState(setting.getLastHeartTime() == null ? MONITOR_UNBOUND : MONITOR_OFFLINE);
            changed = true;
        }
        if (changed) {
            setting.setUpdateTime(new Date());
            paymentVmqSettingMapper.updateById(setting);
        }
        return setting;
    }

    private PaymentVmqSetting refreshMonitorState(PaymentVmqSetting setting) {
        if (setting == null) {
            return getOrCreateSetting();
        }
        String nextState = resolveMonitorState(setting.getLastHeartTime());
        if (!nextState.equals(setting.getMonitorState())) {
            setting.setMonitorState(nextState);
            setting.setUpdateTime(new Date());
            paymentVmqSettingMapper.updateById(setting);
        }
        return setting;
    }

    private String resolveMonitorState(Date lastHeartTime) {
        if (lastHeartTime == null) {
            return MONITOR_UNBOUND;
        }
        long seconds = Duration.between(lastHeartTime.toInstant(), Instant.now()).getSeconds();
        return seconds <= 75 ? MONITOR_ONLINE : MONITOR_OFFLINE;
    }

    private BigDecimal allocateUniqueAmount(PaymentVmqSetting setting, Long excludeOrderId, BigDecimal requestedAmount) {
        String channel = channelForPayType(setting.getPayType());
        boolean decrease = STRATEGY_DECREASE.equalsIgnoreCase(setting.getAmountStrategy());
        for (int i = 0; i <= 200; i++) {
            BigDecimal offset = CENT.multiply(BigDecimal.valueOf(i));
            BigDecimal candidate = decrease
                    ? requestedAmount.subtract(offset)
                    : requestedAmount.add(offset);
            candidate = candidate.setScale(2, RoundingMode.HALF_UP);
            if (candidate.compareTo(MIN_AMOUNT) < 0) {
                continue;
            }
            if (!hasActiveOrderAmount(channel, candidate, excludeOrderId)) {
                return candidate;
            }
        }
        throw ApiException.badRequest("当前待支付订单金额冲突过多，请稍后重试");
    }

    private boolean hasActiveOrderAmount(String channel, BigDecimal amount, Long excludeOrderId) {
        QueryWrapper<PaymentOrder> queryWrapper = new QueryWrapper<PaymentOrder>()
                .eq("channel", channel)
                .eq("total_amount", amount)
                .in("status", STATUS_CREATED, STATUS_WAIT_BUYER_PAY)
                .and(wrapper -> wrapper.isNull("expire_time").or().gt("expire_time", new Date()));
        if (excludeOrderId != null) {
            queryWrapper.ne("id", excludeOrderId);
        }
        Long count = paymentOrderMapper.selectCount(queryWrapper);
        return count != null && count > 0;
    }

    private BigDecimal requireOrderAmount(PaymentOrder order) {
        if (order == null || order.getTotalAmount() == null) {
            throw ApiException.badRequest("支付订单金额不能为空");
        }
        return order.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
    }

    private boolean verifyHeartSign(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return false;
        }
        PaymentVmqSetting setting = getOrCreateSetting();
        String key = normalizeNullableText(setting.getCommunicationKey());
        String t = normalizeNullableText(params.get("t"));
        String sign = normalizeNullableText(params.get("sign"));
        if (key == null || t == null || sign == null) {
            return false;
        }
        return sign.equalsIgnoreCase(md5(t + key));
    }

    private String channelForPayType(Integer payType) {
        return payType != null && payType == 1 ? "VMQ_WECHAT" : "VMQ_ALIPAY";
    }

    private String selectedPayUrl(PaymentVmqSetting setting) {
        if (setting == null || (setting.getPayType() != null && setting.getPayType() == 1)) {
            return setting == null ? null : setting.getWxPayUrl();
        }
        return setting.getAlipayPayUrl();
    }

    private int normalizePayType(Integer payType) {
        if (payType == null) {
            return 2;
        }
        if (payType != 1 && payType != 2) {
            throw ApiException.badRequest("V免签支付方式仅支持微信或支付宝");
        }
        return payType;
    }

    private String normalizeAmountStrategy(String amountStrategy) {
        String normalized = normalizeNullableText(amountStrategy);
        if (normalized == null) {
            return STRATEGY_INCREASE;
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (!STRATEGY_INCREASE.equals(upper) && !STRATEGY_DECREASE.equals(upper)) {
            throw ApiException.badRequest("金额区分策略仅支持加价或减价");
        }
        return upper;
    }

    private int normalizeTimeoutMinutes(Integer value) {
        if (value == null) {
            return 5;
        }
        return Math.max(1, Math.min(value, 1440));
    }

    private String normalizeCommunicationKey(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            return generateCommunicationKey();
        }
        if (!normalized.matches("^[A-Za-z0-9_-]{16,64}$")) {
            throw ApiException.badRequest("通讯密钥需为 16-64 位字母、数字、下划线或短横线");
        }
        return normalized;
    }

    private String generateCommunicationKey() {
        byte[] bytes = new byte[16];
        SECURE_RANDOM.nextBytes(bytes);
        StringBuilder builder = new StringBuilder(32);
        for (byte item : bytes) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    private long epochSeconds(Date date) {
        return date == null ? 0 : date.toInstant().getEpochSecond();
    }

    private String normalizedMonitorBaseUrl() {
        String normalized = normalizeNullableText(siteBaseUrl);
        if (normalized == null) {
            return "";
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String md5(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                builder.append(String.format("%02x", item & 0xff));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("MD5 digest is unavailable", exception);
        }
    }

    private Long parseEpochSecond(String value) {
        try {
            long parsed = Long.parseLong(value);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private void logOperation(User operator, String actionType, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("VMQ_SETTING");
        log.setTargetId(SETTING_ID);
        log.setTargetName("V免签配置");
        log.setDetail(limitText(detail, 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeNullableText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
