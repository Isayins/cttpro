package com.idncar.model.dto;

import com.idncar.model.entity.MailSendLog;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Date;

@Data
public class MailSendLogDto {

    private Long id;
    private String mailType;
    private String triggerType;
    private String orderNo;
    private Long productId;
    private String productTitle;
    private Long deliveryCodeId;
    private String recipientEmail;
    private String subject;
    private String status;
    private String errorMessage;
    private String createTime;

    public static MailSendLogDto fromEntity(MailSendLog entity) {
        MailSendLogDto dto = new MailSendLogDto();
        dto.setId(entity.getId());
        dto.setMailType(entity.getMailType());
        dto.setTriggerType(entity.getTriggerType());
        dto.setOrderNo(entity.getOrderNo());
        dto.setProductId(entity.getProductId());
        dto.setProductTitle(entity.getProductTitle());
        dto.setDeliveryCodeId(entity.getDeliveryCodeId());
        dto.setRecipientEmail(entity.getRecipientEmail());
        dto.setSubject(entity.getSubject());
        dto.setStatus(entity.getStatus());
        dto.setErrorMessage(entity.getErrorMessage());
        dto.setCreateTime(formatDate(entity.getCreateTime()));
        return dto;
    }

    private static String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}
