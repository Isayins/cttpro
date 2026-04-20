package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("post_reports")
public class PostReport {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long postId;
    private Long reporterId;
    private String reason;
    private String detail;
    private String status;
    private Long reviewedBy;
    private String reviewNote;
    private Date reviewedAt;
    private Date createTime;
    private Date updateTime;
}
