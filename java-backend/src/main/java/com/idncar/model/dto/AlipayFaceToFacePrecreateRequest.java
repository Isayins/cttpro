package com.idncar.model.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class AlipayFaceToFacePrecreateRequest {

    private String subject;
    private String body;
    private BigDecimal totalAmount;
    private Long productId;
    private String couponCode;
    private String deliveryEmail;
    private String resourceType;
    private Long resourceId;
}
