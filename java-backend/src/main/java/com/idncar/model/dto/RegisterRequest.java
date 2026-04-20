package com.idncar.model.dto;

import lombok.Data;

@Data
public class RegisterRequest {

    private String username;
    private String email;
    private String password;
    private String nickname;
    private String inviteCode;
    private String emailCode;
}
