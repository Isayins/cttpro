package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("qr_codes")
public class QrCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;
    private String description;
    private String shortCode;
    private String targetUrl;
    private String contentType;
    private String htmlContent;
    private Long totalScanCount;
    private String status;
    private Boolean loginRequired;
    private Boolean accessCodeRequired;
    private String accessCode;
    private Date expiresAt;
    private Long createdBy;
    private Date createTime;
    private Date updateTime;
}
