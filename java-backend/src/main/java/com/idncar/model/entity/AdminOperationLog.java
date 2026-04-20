package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("admin_operation_logs")
public class AdminOperationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long operatorId;
    private String operatorRole;
    private String actionType;
    private String targetType;
    private Long targetId;
    private String targetName;
    private String detail;
    private Date createTime;
}
