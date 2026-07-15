package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("payment_vmq_events")
public class PaymentVmqEvent {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String eventId;
    private Integer payType;
    private BigDecimal amount;
    private Date paidAt;
    private String orderNo;
    private String status;
    private String payload;
    private Date createTime;
    private Date updateTime;
}
