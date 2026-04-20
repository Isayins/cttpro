package com.idncar.model.dto;

import com.idncar.model.entity.UserNotification;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class UserNotificationDto {

    private Long id;
    private String type;
    private String title;
    private String content;
    private String relatedPath;
    private Boolean read;
    private String createTime;

    public static UserNotificationDto fromEntity(UserNotification entity) {
        UserNotificationDto dto = new UserNotificationDto();
        dto.setId(entity.getId());
        dto.setType(entity.getType());
        dto.setTitle(entity.getTitle());
        dto.setContent(entity.getContent());
        dto.setRelatedPath(entity.getRelatedPath());
        dto.setRead(Boolean.TRUE.equals(entity.getReadStatus()));
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
