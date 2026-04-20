package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("site_visit_logs")
public class SiteVisitLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String path;
    private String pageTitle;
    private String visitorId;
    private String sessionId;
    private Long userId;
    private String referrer;
    private String source;
    private String deviceType;
    private String userAgent;
    private String ipAddress;
    private Date createTime;
}
