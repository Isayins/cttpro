package com.idncar.model.dto;

import lombok.Data;

@Data
public class ProductCouponPreviewDto {

    private String code;
    private Long productId;
    private String productTitle;
    private String discountType;
    private String discountValue;
    private String originalAmount;
    private String discountAmount;
    private String payableAmount;
    private String expiresAt;
}
