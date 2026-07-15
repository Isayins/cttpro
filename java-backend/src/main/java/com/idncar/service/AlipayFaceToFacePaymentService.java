package com.idncar.service;

import com.idncar.model.dto.AlipayFaceToFacePrecreateRequest;
import com.idncar.model.dto.AdminPaymentOrderDto;
import com.idncar.model.dto.AdminPaymentOrderStatsDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.PaymentOrderDto;
import com.idncar.model.dto.ResolvePaymentOrderRequest;

import java.util.Map;

public interface AlipayFaceToFacePaymentService {

    PaymentOrderDto precreate(Long userId, AlipayFaceToFacePrecreateRequest request);

    PaymentOrderDto query(Long userId, String outTradeNo);

    PaymentOrderDto close(Long userId, String outTradeNo);

    PageResultDto<PaymentOrderDto> getUserOrders(Long userId, Integer page, Integer size, String status, String keyword);

    PageResultDto<AdminPaymentOrderDto> getAdminOrders(Long adminUserId, Integer page, Integer size, String keyword, String status, String resourceType, Boolean hasError, Boolean hasCoupon);

    AdminPaymentOrderStatsDto getAdminOrderStats(Long adminUserId);

    AdminPaymentOrderDto adminQuery(Long adminUserId, String outTradeNo);

    AdminPaymentOrderDto adminClose(Long adminUserId, String outTradeNo);

    AdminPaymentOrderDto adminManualConfirm(Long adminUserId, String outTradeNo, ResolvePaymentOrderRequest request);

    AdminPaymentOrderDto adminResendDelivery(Long adminUserId, String outTradeNo);

    AdminPaymentOrderDto adminResolve(Long adminUserId, String outTradeNo, ResolvePaymentOrderRequest request);

    boolean handleNotify(Map<String, String> params);

    boolean handleVmqNotify(Map<String, String> params);

    boolean handleVmqAppPush(Map<String, String> params);
}
