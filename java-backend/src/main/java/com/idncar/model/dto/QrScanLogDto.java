package com.idncar.model.dto;

import com.idncar.model.entity.QrScanLog;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class QrScanLogDto {

    private Long id;
    private Long qrCodeId;
    private Long userId;
    private String nickname;
    private String visitorId;
    private String source;
    private String deviceType;
    private String ipAddress;
    private String createTime;

    public static QrScanLogDto fromEntity(QrScanLog entity, User user) {
        QrScanLogDto dto = new QrScanLogDto();
        dto.setId(entity.getId());
        dto.setQrCodeId(entity.getQrCodeId());
        dto.setUserId(entity.getUserId());
        dto.setNickname(user == null ? null : user.getNickname());
        dto.setVisitorId(maskVisitorId(entity.getVisitorId()));
        dto.setSource(entity.getSource());
        dto.setDeviceType(entity.getDeviceType());
        dto.setIpAddress(entity.getIpAddress());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        return dto;
    }

    private static String maskVisitorId(String visitorId) {
        if (visitorId == null || visitorId.length() <= 8) {
            return visitorId;
        }
        return visitorId.substring(0, 4) + "..." + visitorId.substring(visitorId.length() - 4);
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
