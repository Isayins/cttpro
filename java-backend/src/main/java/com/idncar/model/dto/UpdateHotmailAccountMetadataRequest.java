package com.idncar.model.dto;

import lombok.Data;

@Data
public class UpdateHotmailAccountMetadataRequest {

    private String groupName;

    private String subEmails;

    private Boolean gptRegistered;

    private String gptRegisteredSubEmails;

    private Boolean grokRegistered;

    private String grokRegisteredSubEmails;
}
