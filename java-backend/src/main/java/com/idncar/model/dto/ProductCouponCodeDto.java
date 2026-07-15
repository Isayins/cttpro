package com.idncar.model.dto;

import com.idncar.model.entity.ProductCouponCode;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class ProductCouponCodeDto {

    private Long id;
    private String code;
    private Long productId;
    private String productTitle;
    private String discountType;
    private String discountValue;
    private String status;
    private Long createdBy;
    private Long usedBy;
    private String usedByName;
    private String usedOrderNo;
    private String usedAt;
    private Long lockedBy;
    private String lockOrderNo;
    private String lockedAt;
    private String expiresAt;
    private String batchNo;
    private String note;
    private String createTime;
    private String updateTime;

    public static ProductCouponCodeDto fromEntity(ProductCouponCode entity, String productTitle, String usedByName) {
        ProductCouponCodeDto dto = new ProductCouponCodeDto();
        dto.setId(entity.getId());
        dto.setCode(entity.getCode());
        dto.setProductId(entity.getProductId());
        dto.setProductTitle(productTitle);
        dto.setDiscountType(entity.getDiscountType());
        dto.setDiscountValue(entity.getDiscountValue() == null ? null : entity.getDiscountValue().toPlainString());
        dto.setStatus(effectiveStatus(entity));
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setUsedBy(entity.getUsedBy());
        dto.setUsedByName(usedByName);
        dto.setUsedOrderNo(entity.getUsedOrderNo());
        dto.setUsedAt(formatDate(entity.getUsedAt()));
        dto.setLockedBy(entity.getLockedBy());
        dto.setLockOrderNo(entity.getLockOrderNo());
        dto.setLockedAt(formatDate(entity.getLockedAt()));
        dto.setExpiresAt(formatDate(entity.getExpiresAt()));
        dto.setBatchNo(entity.getBatchNo());
        dto.setNote(entity.getNote());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        dto.setUpdateTime(formatDate(entity.getUpdateTime()));
        return dto;
    }

    private static String effectiveStatus(ProductCouponCode entity) {
        if ("ACTIVE".equalsIgnoreCase(entity.getStatus())
                && entity.getExpiresAt() != null
                && !entity.getExpiresAt().after(new Date())) {
            return "EXPIRED";
        }
        return entity.getStatus();
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
