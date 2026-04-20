package com.idncar.model.dto;

import com.idncar.model.entity.User;
import lombok.Data;

@Data
public class UserDto {

    private Long id;
    private String username;
    private String nickname;
    private String role;

    public static UserDto fromEntity(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setNickname(user.getNickname());
        dto.setRole(user.getRole());
        return dto;
    }
}
