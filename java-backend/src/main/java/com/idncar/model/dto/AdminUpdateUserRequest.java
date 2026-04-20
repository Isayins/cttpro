package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminUpdateUserRequest {

    private String nickname;
    private String avatarUrl;
    private String bio;
    private String role;
    private String status;
    private String password;
}
