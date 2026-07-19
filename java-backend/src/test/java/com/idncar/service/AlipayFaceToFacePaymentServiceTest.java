package com.idncar.service;

import com.idncar.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.PaymentVmqEventMapper;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.OrderSupportRequest;
import com.idncar.model.dto.AlipayFaceToFacePrecreateRequest;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.PaymentVmqEvent;
import com.idncar.model.entity.User;
import com.idncar.service.InternalVmqPaymentService;
import com.idncar.service.AlipayFaceToFacePaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlipayFaceToFacePaymentServiceTest {

    private final AlipayFaceToFacePaymentService service = new AlipayFaceToFacePaymentService();

    @Test
    void paymentOrderRequiresAProduct() {
        assertThatThrownBy(() -> service.precreate(7L, new AlipayFaceToFacePrecreateRequest()))
                .isInstanceOf(ApiException.class)
                .hasMessage("请选择要购买的商品");
    }

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

    @Test
    void userCanResendDeliveryForOwnedPaidOrderWithCooldown() throws Exception {
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        ProductDeliveryCodeService deliveryCodeService = mock(ProductDeliveryCodeService.class);
        NotificationService notificationService = mock(NotificationService.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> values = mock(ValueOperations.class);

        PaymentOrder order = new PaymentOrder();
        order.setId(11L);
        order.setOutTradeNo("202607180001");
        order.setPayerUserId(7L);
        order.setResourceType("PRODUCT");
        order.setResourceId(3L);
        order.setStatus("TRADE_SUCCESS");
        order.setDeliveryEmail("buyer@example.com");
        when(orderMapper.selectOne(any())).thenReturn(order);
        when(orderMapper.selectById(11L)).thenReturn(order);
        when(redisTemplate.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(
                "payment:delivery-resend:cooldown:11", "1", 60L, TimeUnit.SECONDS
        )).thenReturn(true);
        setField("paymentOrderMapper", orderMapper);
        setField("productDeliveryCodeService", deliveryCodeService);
        setField("notificationService", notificationService);
        setField("userAccessService", userAccessService);
        setField("redisTemplate", redisTemplate);

        assertThat(service.resendDelivery(7L, order.getOutTradeNo()).getOutTradeNo())
                .isEqualTo(order.getOutTradeNo());
        verify(deliveryCodeService).resendPaidOrder(order);
        verify(notificationService).createNotification(
                7L,
                "DELIVERY_RESENT",
                "发货邮件已重新发送",
                "订单 202607180001 的发货邮件已重新发送，请查收邮箱和垃圾箱。",
                "/orders"
        );
    }

    @Test
    void orderSupportCanBeSubmittedAndResolved() throws Exception {
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        AdminOperationLogMapper operationLogMapper = mock(AdminOperationLogMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        NotificationService notificationService = mock(NotificationService.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        PaymentOrder order = new PaymentOrder();
        order.setId(12L);
        order.setOutTradeNo("202607180002");
        order.setPayerUserId(7L);
        when(orderMapper.selectOne(any())).thenReturn(order);
        when(orderMapper.selectById(12L)).thenReturn(order);
        User admin = new User();
        admin.setId(1L);
        admin.setNickname("管理员");
        when(userAccessService.requireAdmin(1L)).thenReturn(admin);
        when(userMapper.selectList(any())).thenReturn(List.of(admin));
        setField("paymentOrderMapper", orderMapper);
        setField("adminOperationLogMapper", operationLogMapper);
        setField("userMapper", userMapper);
        setField("notificationService", notificationService);
        setField("userAccessService", userAccessService);

        OrderSupportRequest issue = new OrderSupportRequest();
        issue.setMessage("没有收到发货邮件");
        service.submitSupport(7L, order.getOutTradeNo(), issue);
        assertThat(order.getSupportStatus()).isEqualTo("OPEN");
        assertThat(order.getSupportMessage()).isEqualTo("没有收到发货邮件");
        verify(notificationService).createNotifications(
                List.of(1L),
                "ORDER_SUPPORT_OPENED",
                "有新的订单售后",
                "订单 202607180002：没有收到发货邮件",
                "/admin#payments"
        );

        OrderSupportRequest reply = new OrderSupportRequest();
        reply.setMessage("已补发，请检查垃圾箱");
        service.adminReplySupport(1L, order.getOutTradeNo(), reply);
        assertThat(order.getSupportStatus()).isEqualTo("RESOLVED");
        assertThat(order.getSupportReply()).isEqualTo("已补发，请检查垃圾箱");
        verify(orderMapper, times(2)).updateById(order);
        verify(notificationService).createNotification(
                7L,
                "ORDER_SUPPORT_REPLIED",
                "订单售后已回复",
                "订单 202607180002：已补发，请检查垃圾箱",
                "/orders"
        );
    }

    @Test
    void adminPaymentStatsIncludeOpenSupportCases() throws Exception {
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        when(orderMapper.selectCount(any())).thenReturn(
                10L, 1L, 2L, 3L, 1L, 1L, 2L, 4L);
        setField("paymentOrderMapper", orderMapper);
        setField("userAccessService", userAccessService);

        assertThat(service.getAdminOrderStats(1L).getOpenSupport()).isEqualTo(4L);
    }

    @Test
    void paymentOrderExportUsesCurrentFiltersAndEscapesCsvCells() throws Exception {
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        PaymentOrder order = new PaymentOrder();
        order.setOutTradeNo("202607190002");
        order.setSubject("商品,高级版");
        order.setTotalAmount(new BigDecimal("9.90"));
        order.setStatus("TRADE_SUCCESS");
        when(orderMapper.selectList(any())).thenReturn(List.of(order));
        when(userMapper.selectList(any())).thenReturn(List.of());
        setField("paymentOrderMapper", orderMapper);
        setField("userMapper", userMapper);
        setField("userAccessService", userAccessService);

        String csv = service.exportAdminOrdersCsv(1L, "高级", "TRADE_SUCCESS", "PRODUCT", null, null, null);

        assertThat(csv).startsWith("\ufeff订单号,")
                .contains("\"202607190002\"")
                .contains("\"商品,高级版\"")
                .contains("\"9.90\"");
    }

    @Test
    void expiredVmqOrdersAreClosedAndReleaseTheirCoupon() throws Exception {
        PaymentOrderMapper orderMapper = mock(PaymentOrderMapper.class);
        ProductCouponCodeService couponCodeService = mock(ProductCouponCodeService.class);
        PaymentOrder order = new PaymentOrder();
        order.setId(18L);
        order.setOutTradeNo("202607190001");
        when(orderMapper.selectList(any())).thenReturn(List.of(order));
        when(orderMapper.update(any(), any())).thenReturn(1);
        setField("paymentOrderMapper", orderMapper);
        setField("productCouponCodeService", couponCodeService);

        service.closeExpiredVmqOrders();

        verify(couponCodeService).releaseCouponForOrder(order);
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
