package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchUpdateHotmailAccountRegistrationRequest {

    private List<Long> accountIds;

    private Boolean gptRegistered;

    private Boolean grokRegistered;
}
