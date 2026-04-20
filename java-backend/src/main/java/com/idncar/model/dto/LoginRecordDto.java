package com.idncar.model.dto;

import com.idncar.model.entity.LoginRecord;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class LoginRecordDto {

    private Long id;
    private String loginIdentity;
    private String ipAddress;
    private String userAgent;
    private String deviceType;
    private String loginStatus;
    private String createTime;

    public static LoginRecordDto fromEntity(LoginRecord entity) {
        LoginRecordDto dto = new LoginRecordDto();
        dto.setId(entity.getId());
        dto.setLoginIdentity(entity.getLoginIdentity());
        dto.setIpAddress(entity.getIpAddress());
        dto.setUserAgent(entity.getUserAgent());
        dto.setDeviceType(entity.getDeviceType());
        dto.setLoginStatus(entity.getLoginStatus());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
