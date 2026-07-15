package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private String email;

    private String password;

    private String nickname;

    private String role;

    private String avatarUrl;

    private String bio;

    private String status;

    private String chatVisibility;

    private Integer experience;

    private Integer level;

    private Integer consecutiveSignInDays;

    private Date lastSignInAt;

    private Date createTime;

    private Date updateTime;
}
