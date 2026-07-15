package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("payment_orders")
public class PaymentOrder {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String channel;
    private String outTradeNo;
    private String tradeNo;
    private String buyerLogonId;
    private String subject;
    private String body;
    private BigDecimal originalAmount;
    private BigDecimal discountAmount;
    private String couponCode;
    private Long couponCodeId;
    private BigDecimal totalAmount;
    private String status;
    private String qrCode;
    private String resourceType;
    private Long resourceId;
    private Long payerUserId;
    private String deliveryEmail;
    private Date expireTime;
    private Date paidTime;
    private Date closedTime;
    private Boolean paidHandled;
    private String notifyPayload;
    private String lastError;
    private Date createTime;
    private Date updateTime;
}
