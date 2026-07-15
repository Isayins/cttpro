package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("product_delivery_codes")
public class ProductDeliveryCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long productId;
    private String code;
    private String status;
    private Long createdBy;
    private Long assignedTo;
    private String orderNo;
    private Date assignedAt;
    private Date sentAt;
    private String batchNo;
    private String note;
    private Date createTime;
    private Date updateTime;
}