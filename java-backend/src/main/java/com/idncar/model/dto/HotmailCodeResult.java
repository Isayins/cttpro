package com.idncar.model.dto;

import lombok.Data;

import java.util.Date;

@Data
public class HotmailCodeResult {

    private Long accountId;

    private String email;

    private String code;

    private String subject;

    private String sender;

    private Date receivedTime;

    private Date fetchTime;

    private String source;

    private String folder;

    private String error;

    private boolean found;

    /**
     * 未能识别到验证码时，从邮件中提取到的验证/激活链接（可能为空）。
     */
    private String link;

    /**
     * 邮件正文的纯文本预览，供人工查看（可能为空）。
     */
    private String bodyPreview;
}
