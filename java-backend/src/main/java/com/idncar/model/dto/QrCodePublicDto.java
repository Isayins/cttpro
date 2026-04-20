package com.idncar.model.dto;

import com.idncar.model.entity.QrCode;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class QrCodePublicDto {

    private Long id;
    private String title;
    private String description;
    private String shortCode;
    private Boolean loginRequired;
    private Boolean accessCodeRequired;
    private Boolean available;
    private String unavailableReason;
    private String expiresAt;

    public static QrCodePublicDto fromEntity(QrCode entity, boolean available, String unavailableReason) {
        QrCodePublicDto dto = new QrCodePublicDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setDescription(entity.getDescription());
        dto.setShortCode(entity.getShortCode());
        dto.setLoginRequired(Boolean.TRUE.equals(entity.getLoginRequired()));
        dto.setAccessCodeRequired(Boolean.TRUE.equals(entity.getAccessCodeRequired()));
        dto.setAvailable(available);
        dto.setUnavailableReason(unavailableReason);
        dto.setExpiresAt(formatDate(entity.getExpiresAt()));
        return dto;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
