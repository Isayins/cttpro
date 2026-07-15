package com.idncar.model.dto;

import lombok.Data;

@Data
public class ImportProductDeliveryCodesRequest {
    private Long productId;
    private String content;
    private String note;
}