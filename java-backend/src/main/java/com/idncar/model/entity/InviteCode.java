package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("invite_codes")
public class InviteCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;

    private Long createdBy;

    private Long usedBy;

    private String status;

    @TableField("is_reusable")
    private Boolean reusable;

    @TableField("usage_count")
    private Integer usageCount;

    private Date expiresAt;

    private Date usedAt;

    private Date createTime;

    private Date updateTime;
}
