package com.idncar.model.dto;

import lombok.Data;

@Data
public class HotmailPasswordResponse {

    private Long accountId;

    private String email;

    private String password;
}
