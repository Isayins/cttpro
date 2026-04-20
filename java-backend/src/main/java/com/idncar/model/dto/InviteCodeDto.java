package com.idncar.model.dto;

import com.idncar.model.entity.InviteCode;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class InviteCodeDto {

    private Long id;
    private String code;
    private String status;
    private Long createdBy;
    private Long usedBy;
    private String usedByNickname;
    private String expiresAt;
    private String usedAt;
    private String createTime;

    public static InviteCodeDto fromEntity(InviteCode inviteCode, User usedByUser) {
        InviteCodeDto dto = new InviteCodeDto();
        dto.setId(inviteCode.getId());
        dto.setCode(inviteCode.getCode());
        dto.setStatus(inviteCode.getStatus());
        dto.setCreatedBy(inviteCode.getCreatedBy());
        dto.setUsedBy(inviteCode.getUsedBy());
        dto.setUsedByNickname(usedByUser == null ? null : usedByUser.getNickname());
        dto.setExpiresAt(formatDate(inviteCode.getExpiresAt()));
        dto.setUsedAt(formatDate(inviteCode.getUsedAt()));
        dto.setCreateTime(formatDate(inviteCode.getCreateTime()));
        return dto;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
