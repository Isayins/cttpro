package com.idncar.service;

import com.idncar.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.PaymentVmqEventMapper;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.PaymentVmqEvent;
import com.idncar.service.InternalVmqPaymentService;
import com.idncar.service.AlipayFaceToFacePaymentService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlipayFaceToFacePaymentServiceTest {

    private final AlipayFaceToFacePaymentService service = new AlipayFaceToFacePaymentService();

    @Test
    void productOrderRequiresDeliveryEmailForNormalProduct() {
        Product product = new Product();
        product.setDeliveryType("NONE");

        assertThatThrownBy(() -> resolveDeliveryEmail(product, " "))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品购买需要填写收货邮箱");
    }

    @Test
    void productOrderNormalizesDeliveryEmailForNormalProduct() throws Throwable {
        Product product = new Product();
        product.setDeliveryType("NONE");

        assertThat(resolveDeliveryEmail(product, " Buyer@Example.COM "))
                .isEqualTo("buyer@example.com");
    }

    @Test
    void nonProductOrderDoesNotRequireDeliveryEmail() throws Throwable {
        assertThat(resolveDeliveryEmail(null, null)).isNull();
    }

    @Test
    void vmqEventMustOccurInsideOrderLifetime() throws Exception {
        long now = System.currentTimeMillis();
        com.idncar.model.entity.PaymentOrder order = new com.idncar.model.entity.PaymentOrder();
        order.setCreateTime(new Date(now));
        order.setExpireTime(new Date(now + 5 * 60_000L));

        assertThat(isVmqEventWithinOrderWindow(order, new Date(now + 30_000L))).isTrue();
        assertThat(isVmqEventWithinOrderWindow(order, new Date(now - 3 * 60_000L))).isFalse();
        assertThat(isVmqEventWithinOrderWindow(order, new Date(now + 8 * 60_000L))).isFalse();
    }

    @Test
    void vmqManualTestPushNeverMatchesOrFulfillsAnOrder() throws Exception {
        InternalVmqPaymentService vmqPaymentService = mock(InternalVmqPaymentService.class);
        when(vmqPaymentService.verifyAppPush(any())).thenReturn(true);
        PaymentVmqEventMapper eventMapper = mock(PaymentVmqEventMapper.class);
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        setField("internalVmqPaymentService", vmqPaymentService);
        setField("paymentVmqEventMapper", eventMapper);
        setField("paymentOrderMapper", orderMapper);
        setField("objectMapper", new ObjectMapper());

        Map<String, String> params = new HashMap<>();
        params.put("type", "2");
        params.put("price", "0.01");
        params.put("paidAt", String.valueOf(System.currentTimeMillis() / 1000L));
        params.put("eventId", "b".repeat(64));
        params.put("mode", "TEST");

        assertThat(service.handleVmqAppPush(params)).isTrue();
        verify(eventMapper).insert(any(PaymentVmqEvent.class));
        verify(eventMapper).updateById(any(PaymentVmqEvent.class));
        verify(vmqPaymentService, never()).recordAppPush();
        verify(orderMapper, never()).selectList(any());
    }

    private String resolveDeliveryEmail(Product product, String deliveryEmail) throws Throwable {
        Method method = AlipayFaceToFacePaymentService.class.getDeclaredMethod(
                "resolveDeliveryEmail",
                Product.class,
                String.class
        );
        method.setAccessible(true);
        try {
            return (String) method.invoke(service, product, deliveryEmail);
        } catch (InvocationTargetException exception) {
            throw exception.getCause();
        }
    }

    private boolean isVmqEventWithinOrderWindow(com.idncar.model.entity.PaymentOrder order, Date paidAt) throws Exception {
        Method method = AlipayFaceToFacePaymentService.class.getDeclaredMethod(
                "isVmqEventWithinOrderWindow",
                com.idncar.model.entity.PaymentOrder.class,
                Date.class
        );
        method.setAccessible(true);
        return (boolean) method.invoke(service, order, paidAt);
    }

    private void setField(String fieldName, Object value) throws Exception {
        java.lang.reflect.Field field = AlipayFaceToFacePaymentService.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(service, value);
    }
}
