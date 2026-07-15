package com.idncar.model.dto;

import com.idncar.model.entity.Product;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class ProductDto {

    private Long id;
    private String title;
    private String subtitle;
    private String description;
    private String imageUrl;
    private String price;
    private Integer stock;
    private Integer salesCount;
    private String deliveryType;
    private String deliveryInstructions;
    private Integer deliveryCodeAvailableCount;
    private Integer deliveryCodeLockedCount;
    private Integer deliveryCodeSentCount;
    private Integer deliveryCodeDisabledCount;
    private String status;
    private Integer sortOrder;
    private String createTime;
    private String updateTime;

    public static ProductDto fromEntity(Product entity) {
        ProductDto dto = new ProductDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setSubtitle(entity.getSubtitle());
        dto.setDescription(entity.getDescription());
        dto.setImageUrl(entity.getImageUrl());
        dto.setPrice(entity.getPrice() == null ? null : entity.getPrice().toPlainString());
        dto.setStock(entity.getStock());
        dto.setSalesCount(entity.getSalesCount() == null ? 0 : entity.getSalesCount());
        dto.setDeliveryType(entity.getDeliveryType() == null ? "NONE" : entity.getDeliveryType());
        dto.setDeliveryInstructions(entity.getDeliveryInstructions());
        dto.setStatus(entity.getStatus());
        dto.setSortOrder(entity.getSortOrder() == null ? 0 : entity.getSortOrder());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
