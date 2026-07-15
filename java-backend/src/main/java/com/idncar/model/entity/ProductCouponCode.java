package com.idncar.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("product_coupon_codes")
public class ProductCouponCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;
    private Long productId;
    private String discountType;
    private BigDecimal discountValue;
    private String status;
    private Long createdBy;
    private Long usedBy;
    private String usedOrderNo;
    private Date usedAt;
    private Long lockedBy;
    private String lockOrderNo;
    private Date lockedAt;
    private Date expiresAt;
    private String batchNo;
    private String note;
    private Date createTime;
    private Date updateTime;
}
