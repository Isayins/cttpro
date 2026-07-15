package com.idncar.service;

import com.idncar.model.dto.SaveVmqPaymentSettingsRequest;
import com.idncar.model.dto.VmqPaymentSettingsDto;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.PaymentVmqSetting;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

public interface InternalVmqPaymentService {

    VmqPaymentSettingsDto getAdminSettings(Long adminUserId);

    VmqPaymentSettingsDto saveAdminSettings(Long adminUserId, SaveVmqPaymentSettingsRequest request);

    VmqPaymentSettingsDto regenerateCommunicationKey(Long adminUserId);

    PaymentVmqSetting getOrCreateSetting();

    boolean isEnabled();

    boolean isConfigured();

    boolean isPreferred();

    String resolveChannelCode();

    VmqOrderDraft createOrderDraft(PaymentOrder order);

    boolean verifyNotify(Map<String, String> params);

    boolean verifyAppPush(Map<String, String> params);

    void recordAppPush();

    VmqApiResponse getState(Map<String, String> params);

    VmqApiResponse appHeart(Map<String, String> params);

    record VmqOrderDraft(int payType, String payUrl, BigDecimal reallyPrice, Date expireTime) {
    }

    record VmqApiResponse(int code, String msg, Object data) {

        public static VmqApiResponse success() {
            return new VmqApiResponse(1, "成功", null);
        }

        public static VmqApiResponse success(Object data) {
            return new VmqApiResponse(1, "成功", data);
        }

        public static VmqApiResponse failure(String message) {
            return new VmqApiResponse(-1, message, null);
        }
    }
}
