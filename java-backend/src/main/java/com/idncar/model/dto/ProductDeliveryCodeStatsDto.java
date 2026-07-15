package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProductDeliveryCodeStatsDto {
    private long total;
    private long available;
    private long locked;
    private long sent;
    private long disabled;
}