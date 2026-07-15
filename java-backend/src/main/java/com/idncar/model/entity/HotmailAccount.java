package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("hotmail_accounts")
public class HotmailAccount {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String email;

    private String groupName;

    private String subEmails;

    private Boolean gptRegistered;

    private String gptRegisteredSubEmails;

    private Boolean grokRegistered;

    private String grokRegisteredSubEmails;

    private String password;

    private String clientId;

    private String refreshToken;

    private String accessToken;

    private Date tokenExpiresAt;

    private String outlookAccessToken;

    private Date outlookTokenExpiresAt;

    private String imapAccessToken;

    private Date imapTokenExpiresAt;

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

    private Boolean publicCodeEnabled;

    private Date publicCodeCreatedAt;

    private Date publicCodeLastAccessTime;

    private Date createTime;

    private Date updateTime;
}
