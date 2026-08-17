package com.idncar.model.dto;

import lombok.Data;

import java.util.Date;

@Data
public class HotmailMessageDto {

    private String id;

    private String subject;

    private String senderName;

    private String senderEmail;

    private Date receivedTime;

    private String preview;

    private String bodyText;

    private boolean bodyTruncated;

    private boolean read;

    private boolean hasAttachments;
}
