package com.idncar.model.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateProductCouponCodesRequest {

    private Long productId;
    private Integer count;
    private String discountType;
    private BigDecimal discountValue;
    private Integer expiresInDays;
    private String prefix;
    private String note;
}
