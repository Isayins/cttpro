package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("mail_send_logs")
public class MailSendLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String mailType;
    private String triggerType;
    private String orderNo;
    private Long productId;
    private String productTitle;
    private Long deliveryCodeId;
    private String recipientEmail;
    private String subject;
    private String status;
    private String errorMessage;
    private Date createTime;
}
