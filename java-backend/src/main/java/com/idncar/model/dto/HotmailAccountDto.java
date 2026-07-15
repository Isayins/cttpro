package com.idncar.model.dto;

import lombok.Data;

import java.util.Date;

@Data
public class HotmailAccountDto {

    private Long id;

    private String email;

    private String groupName;

    private String subEmails;

    private boolean gptRegistered;

    private String gptRegisteredSubEmails;

    private boolean grokRegistered;

    private String grokRegisteredSubEmails;

    private boolean passwordSaved;

    private String lastCode;

    private Date lastCodeTime;

    private String lastSubject;

    private String lastSender;

    private String lastSource;

    private String lastFolder;

    private String lastError;

    private Date lastFetchTime;

    private String tokenCheckStatus;

    private Boolean graphTokenOk;

    private Boolean outlookTokenOk;

    private Boolean imapTokenOk;

    private String tokenCheckSummary;

    private Date tokenCheckedAt;

    private String publicCodeToken;

    private String publicCodeUid;

    private String publicCodeTargetEmail;

    private boolean publicCodeEnabled;

    private Date publicCodeCreatedAt;

    private Date publicCodeLastAccessTime;

    private Date createTime;
}
