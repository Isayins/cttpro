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
        dto.setCreateTime(formatDate(user.getCreateTime()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
