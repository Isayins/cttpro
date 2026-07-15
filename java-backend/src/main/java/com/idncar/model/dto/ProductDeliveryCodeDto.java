package com.idncar.model.dto;

import com.idncar.model.entity.ProductDeliveryCode;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class ProductDeliveryCodeDto {

    private Long id;
    private Long productId;
    private String productTitle;
    private String code;
    private String status;
    private Long createdBy;
    private Long assignedTo;
    private String assignedToName;
    private String orderNo;
    private String assignedAt;
    private String sentAt;
    private String batchNo;
    private String note;
    private String createTime;
    private String updateTime;

    public static ProductDeliveryCodeDto fromEntity(ProductDeliveryCode entity, String productTitle, String assignedToName) {
        ProductDeliveryCodeDto dto = new ProductDeliveryCodeDto();
        dto.setId(entity.getId());
        dto.setProductId(entity.getProductId());
        dto.setProductTitle(productTitle);
        dto.setCode(entity.getCode());
        dto.setStatus(entity.getStatus());
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setAssignedTo(entity.getAssignedTo());
        dto.setAssignedToName(assignedToName);
        dto.setOrderNo(entity.getOrderNo());
        dto.setAssignedAt(formatDate(entity.getAssignedAt()));
        dto.setSentAt(formatDate(entity.getSentAt()));
        dto.setBatchNo(entity.getBatchNo());
        dto.setNote(entity.getNote());
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