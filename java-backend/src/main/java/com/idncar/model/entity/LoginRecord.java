package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("login_records")
public class LoginRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private String loginIdentity;
    private String ipAddress;
    private String userAgent;
    private String deviceType;
    private String loginStatus;
    private Date createTime;
}
