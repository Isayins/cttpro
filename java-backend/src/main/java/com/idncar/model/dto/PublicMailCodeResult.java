package com.idncar.model.dto;

import lombok.Data;

import java.util.Date;

@Data
public class PublicMailCodeResult {

    private String email;

    private String code;

    private Date receivedTime;

    private Date fetchTime;

    private String source;

    private String error;

    private boolean found;

    private String link;

    private String bodyPreview;
}
