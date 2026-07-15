package com.idncar.model.dto;

import lombok.Data;

@Data
public class PreviewProductCouponCodeRequest {

    private Long productId;
    private String couponCode;
}
