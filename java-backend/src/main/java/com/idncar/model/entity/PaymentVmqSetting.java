package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("payment_vmq_settings")
public class PaymentVmqSetting {

    @TableId(type = IdType.INPUT)
    private Long id;

    private Boolean enabled;
    private Boolean preferred;
    private Integer payType;
    private String communicationKey;
    private String wxPayUrl;
    private String alipayPayUrl;
    private String amountStrategy;
    private Integer orderTimeoutMinutes;
    private String monitorState;
    private Date lastHeartTime;
    private Date lastPayTime;
    private Date createTime;
    private Date updateTime;
}
