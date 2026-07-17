package com.idncar.model.dto;

import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class AdminPaymentOrderDto {

    private Long id;
    private String channel;
    private String outTradeNo;
    private String tradeNo;
    private String buyerLogonId;
    private String subject;
    private String body;
    private String originalAmount;
    private String discountAmount;
    private String couponCode;
    private String totalAmount;
    private String status;
    private String qrCode;
    private String resourceType;
    private Long resourceId;
    private Long payerUserId;
    private String deliveryEmail;
    private String payerName;
    private String payerUsername;
    private String expireTime;
    private String paidTime;
    private String closedTime;
    private Boolean paidHandled;
    private String lastError;
    private String supportStatus;
    private String supportMessage;
    private String supportReply;
    private String supportUpdatedAt;
    private String createTime;
    private String updateTime;

    public static AdminPaymentOrderDto fromEntity(PaymentOrder entity, User payer) {
        AdminPaymentOrderDto dto = new AdminPaymentOrderDto();
        dto.setId(entity.getId());
        dto.setChannel(entity.getChannel());
        dto.setOutTradeNo(entity.getOutTradeNo());
        dto.setTradeNo(entity.getTradeNo());
        dto.setBuyerLogonId(entity.getBuyerLogonId());
        dto.setSubject(entity.getSubject());
        dto.setBody(entity.getBody());
        dto.setOriginalAmount(entity.getOriginalAmount() == null ? null : entity.getOriginalAmount().toPlainString());
        dto.setDiscountAmount(entity.getDiscountAmount() == null ? null : entity.getDiscountAmount().toPlainString());
        dto.setCouponCode(entity.getCouponCode());
        dto.setTotalAmount(entity.getTotalAmount() == null ? null : entity.getTotalAmount().toPlainString());
        dto.setStatus(entity.getStatus());
        dto.setQrCode(entity.getQrCode());
        dto.setResourceType(entity.getResourceType());
        dto.setResourceId(entity.getResourceId());
        dto.setPayerUserId(entity.getPayerUserId());
        dto.setDeliveryEmail(entity.getDeliveryEmail());
        dto.setPayerName(payer == null ? null : payer.getNickname());
        dto.setPayerUsername(payer == null ? null : payer.getUsername());
        dto.setExpireTime(formatDate(entity.getExpireTime()));
        dto.setPaidTime(formatDate(entity.getPaidTime()));
        dto.setClosedTime(formatDate(entity.getClosedTime()));
        dto.setPaidHandled(entity.getPaidHandled());
        dto.setLastError(entity.getLastError());
        dto.setSupportStatus(entity.getSupportStatus());
        dto.setSupportMessage(entity.getSupportMessage());
        dto.setSupportReply(entity.getSupportReply());
        dto.setSupportUpdatedAt(formatDate(entity.getSupportUpdatedAt()));
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
