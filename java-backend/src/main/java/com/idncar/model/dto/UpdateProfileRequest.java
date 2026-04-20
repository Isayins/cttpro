package com.idncar.model.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {

    private String nickname;
    private String avatarUrl;
    private String bio;
}
