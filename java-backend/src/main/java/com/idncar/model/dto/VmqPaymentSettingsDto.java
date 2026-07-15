package com.idncar.model.dto;

import com.idncar.model.entity.PaymentVmqSetting;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class VmqPaymentSettingsDto {

    private Long id;
    private Boolean enabled;
    private Boolean preferred;
    private Integer payType;
    private String payTypeLabel;
    private String communicationKey;
    private String wxPayUrl;
    private String alipayPayUrl;
    private String amountStrategy;
    private Integer orderTimeoutMinutes;
    private String monitorState;
    private String lastHeartTime;
    private String lastPayTime;
    private String monitorBaseUrl;
    private String getStateUrl;
    private String appHeartUrl;
    private String appPushUrl;
    private String createTime;
    private String updateTime;

    public static VmqPaymentSettingsDto fromEntity(PaymentVmqSetting entity, String monitorBaseUrl) {
        VmqPaymentSettingsDto dto = new VmqPaymentSettingsDto();
        dto.setId(entity.getId());
        dto.setEnabled(Boolean.TRUE.equals(entity.getEnabled()));
        dto.setPreferred(Boolean.TRUE.equals(entity.getPreferred()));
        dto.setPayType(entity.getPayType());
        dto.setPayTypeLabel(entity.getPayType() != null && entity.getPayType() == 1 ? "微信" : "支付宝");
        dto.setCommunicationKey(entity.getCommunicationKey());
        dto.setWxPayUrl(entity.getWxPayUrl());
        dto.setAlipayPayUrl(entity.getAlipayPayUrl());
        dto.setAmountStrategy(entity.getAmountStrategy());
        dto.setOrderTimeoutMinutes(entity.getOrderTimeoutMinutes());
        dto.setMonitorState(entity.getMonitorState());
        dto.setLastHeartTime(formatDate(entity.getLastHeartTime()));
        dto.setLastPayTime(formatDate(entity.getLastPayTime()));
        dto.setMonitorBaseUrl(monitorBaseUrl);
        dto.setGetStateUrl(buildUrl(monitorBaseUrl, "/getState"));
        dto.setAppHeartUrl(buildUrl(monitorBaseUrl, "/appHeart"));
        dto.setAppPushUrl(buildUrl(monitorBaseUrl, "/appPush"));
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    private static String buildUrl(String baseUrl, String path) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return path;
        }
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized + path;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
