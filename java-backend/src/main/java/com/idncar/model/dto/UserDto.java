package com.idncar.model.dto;

import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class UserDto {

    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String role;
    private String avatarUrl;
    private String bio;
    private String status;
    private String chatVisibility;
    private Integer experience;
    private Integer level;
    private Integer consecutiveSignInDays;
    private String lastSignInAt;
    private String title;
    private String createTime;

    public static UserDto fromEntity(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setNickname(user.getNickname());
        dto.setRole(user.getRole());
        dto.setAvatarUrl(user.getAvatarUrl());
        dto.setBio(user.getBio());
        dto.setStatus(user.getStatus());
        dto.setChatVisibility(user.getChatVisibility());
        dto.setExperience(user.getExperience() == null ? 0 : user.getExperience());
        dto.setLevel(user.getLevel() == null ? 1 : user.getLevel());
        dto.setConsecutiveSignInDays(user.getConsecutiveSignInDays() == null ? 0 : user.getConsecutiveSignInDays());
        dto.setLastSignInAt(formatDate(user.getLastSignInAt()));
        dto.setTitle(resolveTitle(user.getLevel() == null ? 1 : user.getLevel()));
        dto.setCreateTime(formatDate(user.getCreateTime()));
        return dto;
    }

    public static String resolveTitle(int level) {
        if (level >= 20) {
            return "传奇吧友";
        }
        if (level >= 15) {
            return "荣誉吧务";
        }
        if (level >= 10) {
            return "核心大佬";
        }
        if (level >= 7) {
            return "活跃先锋";
        }
        if (level >= 4) {
            return "资深吧友";
        }
        if (level >= 2) {
            return "常驻吧友";
        }
        return "新晋吧友";
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
