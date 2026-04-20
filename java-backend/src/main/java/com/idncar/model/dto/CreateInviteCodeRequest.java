package com.idncar.model.dto;

import lombok.Data;

@Data
public class CreateInviteCodeRequest {

    private Integer count;
    private Integer expiresInDays;
}
