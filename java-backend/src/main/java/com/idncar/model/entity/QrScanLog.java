package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("qr_scan_logs")
public class QrScanLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long qrCodeId;
    private Long userId;
    private String visitorId;
    private String sessionId;
    private String source;
    private String deviceType;
    private String userAgent;
    private String ipAddress;
    private Date createTime;
}
