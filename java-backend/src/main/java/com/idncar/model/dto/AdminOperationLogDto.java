package com.idncar.model.dto;

import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class AdminOperationLogDto {

    private Long id;
    private Long operatorId;
    private String operatorName;
    private String operatorRole;
    private String actionType;
    private String targetType;
    private Long targetId;
    private String targetName;
    private String detail;
    private String createTime;

    public static AdminOperationLogDto fromEntity(AdminOperationLog entity, User operator) {
        AdminOperationLogDto dto = new AdminOperationLogDto();
        dto.setId(entity.getId());
        dto.setOperatorId(entity.getOperatorId());
        dto.setOperatorName(operator == null ? "管理员" : operator.getNickname());
        dto.setOperatorRole(entity.getOperatorRole());
        dto.setActionType(entity.getActionType());
        dto.setTargetType(entity.getTargetType());
        dto.setTargetId(entity.getTargetId());
        dto.setTargetName(entity.getTargetName());
        dto.setDetail(entity.getDetail());
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
