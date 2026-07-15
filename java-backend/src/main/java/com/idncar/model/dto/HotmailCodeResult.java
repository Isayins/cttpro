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
}
