package com.idncar.model.dto;

import lombok.Data;

@Data
public class AlipayFaceToFacePrecreateRequest {

    private Long productId;
    private String couponCode;
    private String deliveryEmail;
}
