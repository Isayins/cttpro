package com.idncar.model.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SaveProductRequest {

    private String title;
    private String subtitle;
    private String description;
    private String imageUrl;
    private BigDecimal price;
    private Integer stock;
    private String deliveryType;
    private String deliveryInstructions;
    private String status;
    private Integer sortOrder;
}
