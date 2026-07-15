package com.idncar.model.dto;

import lombok.Data;

@Data
public class SaveVmqPaymentSettingsRequest {

    private Boolean enabled;
    private Boolean preferred;
    private Integer payType;
    private String communicationKey;
    private String wxPayUrl;
    private String alipayPayUrl;
    private String amountStrategy;
    private Integer orderTimeoutMinutes;
}
