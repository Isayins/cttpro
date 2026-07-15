package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductCouponStatsDto {

    private Long total;
    private Long active;
    private Long locked;
    private Long used;
    private Long disabled;
    private Long expired;
}
