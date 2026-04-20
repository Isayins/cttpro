package com.idncar.model.dto;

import com.idncar.model.entity.QrCode;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class QrCodeDto {

    private Long id;
    private String title;
    private String description;
    private String shortCode;
    private String targetUrl;
    private String status;
    private Boolean loginRequired;
    private Boolean accessCodeRequired;
    private Boolean accessCodeConfigured;
    private String accessCodeHint;
    private String expiresAt;
    private Long createdBy;
    private Long scanCount;
    private Long todayScanCount;
    private String lastScanTime;
    private String createTime;
    private String updateTime;

    public static QrCodeDto fromEntity(QrCode entity, long scanCount, long todayScanCount, Date lastScanTime) {
        QrCodeDto dto = new QrCodeDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setDescription(entity.getDescription());
        dto.setShortCode(entity.getShortCode());
        dto.setTargetUrl(entity.getTargetUrl());
        dto.setStatus(entity.getStatus());
        dto.setLoginRequired(Boolean.TRUE.equals(entity.getLoginRequired()));
        dto.setAccessCodeRequired(Boolean.TRUE.equals(entity.getAccessCodeRequired()));
        dto.setAccessCodeConfigured(entity.getAccessCode() != null && !entity.getAccessCode().isBlank());
        dto.setAccessCodeHint(maskAccessCode(entity.getAccessCode()));
        dto.setExpiresAt(formatDate(entity.getExpiresAt()));
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setScanCount(scanCount);
        dto.setTodayScanCount(todayScanCount);
        dto.setLastScanTime(formatDate(lastScanTime));
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    private static String maskAccessCode(String accessCode) {
        if (accessCode == null || accessCode.isBlank()) {
            return null;
        }
        if (accessCode.length() <= 2) {
            return "*".repeat(accessCode.length());
        }
        return accessCode.substring(0, 1) + "*".repeat(accessCode.length() - 2) + accessCode.substring(accessCode.length() - 1);
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
