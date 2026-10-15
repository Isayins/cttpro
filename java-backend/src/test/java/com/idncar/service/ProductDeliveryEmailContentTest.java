package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.MailSendLogMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.entity.MailSendLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductDeliveryCode;
import com.idncar.service.impl.MailBrandTemplateHelper;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Properties;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ProductDeliveryEmailContentTest {
    private static final String CONTENT_ERROR = "商品尚未配置交付内容，请联系管理员处理";

    @Mock private ProductMapper productMapper;
    @Mock private ProductDeliveryCodeMapper deliveryCodeMapper;
    @Mock private PaymentOrderMapper paymentOrderMapper;
    @Mock private UserMapper userMapper;
    @Mock private MailSendLogMapper mailSendLogMapper;
    @Mock private JavaMailSender mailSender;
    @Mock private ObjectProvider<JavaMailSender> mailSenderProvider;
    @Mock private PlatformTransactionManager transactionManager;
    @InjectMocks private ProductDeliveryCodeService service;
    private AutoCloseable mocks;
    private MimeMessage message;
    private Product product;
    private PaymentOrder order;

    @BeforeEach
    void prepareDelivery() throws Exception {
        mocks = MockitoAnnotations.openMocks(this);
        product = new Product();
        product.setId(31L);
        product.setTitle("交付回归商品");
        product.setDeliveryType("NONE");
        product.setDescription("公开商品介绍，不是交付内容");
        product.setSubtitle("公开副标题，不是交付内容");
        order = new PaymentOrder();
        order.setId(41L);
        order.setResourceId(product.getId());
        order.setOutTradeNo("DELIVERY-CONTENT-REGRESSION");
        order.setDeliveryEmail("buyer@example.invalid");
        order.setStatus("TRADE_SUCCESS");
        order.setPaidHandled(true);
        message = new MimeMessage(Session.getInstance(new Properties()));
        when(productMapper.selectById(product.getId())).thenReturn(product);
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        when(mailSender.createMimeMessage()).thenReturn(message);
        when(mailSendLogMapper.insert(any(MailSendLog.class))).thenReturn(1);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        ReflectionTestUtils.setField(service, "mailFrom", "sender@example.invalid");
        ReflectionTestUtils.setField(service, "mailBrandTemplateHelper",
                new MailBrandTemplateHelper("https://idncar.com", "https://idncar.com/logo.png"));
    }

    @AfterEach
    void releaseMocks() throws Exception {
        mocks.close();
    }

    static Stream<Arguments> ordinaryProductsWithoutContent() {
        return Stream.of("NONE", (String) null).flatMap(type ->
                Stream.of(null, "", " \t\r\n ").map(content -> Arguments.of(type, content)));
    }

    @ParameterizedTest
    @MethodSource("ordinaryProductsWithoutContent")
    void paidOrdinaryOrderWithoutContentFailsWithoutSendingOrChangingPayment(String type, String content) {
        product.setDeliveryType(type);
        product.setDeliveryInstructions(content);

        assertThat(service.fulfillPaidOrder(order)).isEqualTo(CONTENT_ERROR);

        assertFailedDeliveryLog();
        verifyNoInteractions(mailSender, deliveryCodeMapper, paymentOrderMapper);
        verify(mailSenderProvider, never()).getIfAvailable();
        assertThat(order.getStatus()).isEqualTo("TRADE_SUCCESS");
        assertThat(order.getPaidHandled()).isTrue();
    }

    @Test
    void ordinaryResendWithoutContentReportsFailureWithoutSending() {
        assertThatThrownBy(() -> service.resendPaidOrder(order))
                .isInstanceOf(ApiException.class).hasMessage(CONTENT_ERROR);

        assertFailedDeliveryLog();
        verifyNoInteractions(mailSender, deliveryCodeMapper, paymentOrderMapper);
        assertThat(order.getStatus()).isEqualTo("TRADE_SUCCESS");
    }

    @Test
    void failureLogPersistenceErrorsRemainVisible() {
        when(mailSendLogMapper.insert(any(MailSendLog.class)))
                .thenThrow(new DataAccessResourceFailureException("fixture database unavailable"));

        assertThatThrownBy(() -> service.fulfillPaidOrder(order))
                .isInstanceOf(DataAccessResourceFailureException.class)
                .hasMessage("fixture database unavailable");

        verifyNoInteractions(mailSender);
    }

    @Test
    void ordinaryResendUsesOnlyExplicitDeliveryInstructions() throws Exception {
        product.setDeliveryInstructions("下载地址：https://example.invalid/private\n提取码：<A&B>");

        service.resendPaidOrder(order);

        verify(mailSender).send(message);
        verifyNoInteractions(deliveryCodeMapper, paymentOrderMapper);
        assertThat(extractText(message))
                .contains("https://example.invalid/private", "提取码：&lt;A&amp;B&gt;")
                .doesNotContain(product.getDescription(), product.getSubtitle());
        assertThat(capturedLog().getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    void successfulResendClearsOnlyTheMatchingOrderConfigurationError() {
        product.setDeliveryInstructions("显式商品交付内容");
        order.setLastError(CONTENT_ERROR);
        when(paymentOrderMapper.update(any(), any())).thenReturn(1);

        service.resendPaidOrder(order);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<UpdateWrapper<PaymentOrder>> update = ArgumentCaptor.forClass(UpdateWrapper.class);
        verify(paymentOrderMapper).update(isNull(), update.capture());
        assertThat(update.getValue().getSqlSegment()).contains("id =", "out_trade_no =", "last_error =");
        assertThat(update.getValue().getParamNameValuePairs().values())
                .contains(order.getId(), order.getOutTradeNo(), CONTENT_ERROR);
        assertThat(order.getLastError()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"支付成功后库存不足，请人工处理", "支付成功后库存不足；" + CONTENT_ERROR})
    void successfulResendPreservesOtherAndCombinedErrors(String existingError) {
        product.setDeliveryInstructions("显式商品交付内容");
        order.setLastError(existingError);

        service.resendPaidOrder(order);

        verifyNoInteractions(paymentOrderMapper);
        assertThat(order.getLastError()).isEqualTo(existingError);
    }

    @Test
    void successfulResendDoesNotClearAnErrorWhenTheConditionalUpdateLosesARace() {
        product.setDeliveryInstructions("显式商品交付内容");
        order.setLastError(CONTENT_ERROR);
        when(paymentOrderMapper.update(any(), any())).thenReturn(0);

        service.resendPaidOrder(order);

        assertThat(order.getLastError()).isEqualTo(CONTENT_ERROR);
        verify(mailSender).send(message);
    }

    @Test
    void smtpFailureKeepsTheExistingConfigurationError() {
        product.setDeliveryInstructions("显式商品交付内容");
        order.setLastError(CONTENT_ERROR);
        doThrow(new MailSendException("fixture SMTP failure")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> service.resendPaidOrder(order))
                .isInstanceOf(ApiException.class).hasMessageContaining("商品发货邮件发送失败");

        verifyNoInteractions(paymentOrderMapper);
        assertThat(order.getLastError()).isEqualTo(CONTENT_ERROR);
    }

    @Test
    void cdkResendKeepsBoundCodeWhenOptionalInstructionsAreAbsent() throws Exception {
        product.setDeliveryType("CDK_EMAIL");
        ProductDeliveryCode code = new ProductDeliveryCode();
        code.setId(51L);
        code.setProductId(product.getId());
        code.setOrderNo(order.getOutTradeNo());
        code.setCode("EXISTING-CDK-CONTENT");
        code.setStatus("SENT");
        when(deliveryCodeMapper.selectOne(any())).thenReturn(code);
        when(deliveryCodeMapper.update(any(), any())).thenReturn(1);

        service.resendPaidOrder(order);

        verify(mailSender).send(message);
        verify(deliveryCodeMapper).selectOne(any());
        verify(deliveryCodeMapper).update(any(), any());
        assertThat(extractText(message)).contains(code.getCode(), "暂无使用教程，请联系管理员补充。");
        MailSendLog log = capturedLog();
        assertThat(log.getStatus()).isEqualTo("SUCCESS");
        assertThat(log.getDeliveryCodeId()).isEqualTo(code.getId());
    }

    private void assertFailedDeliveryLog() {
        MailSendLog log = capturedLog();
        assertThat(log.getStatus()).isEqualTo("FAILED");
        assertThat(log.getErrorMessage()).isEqualTo(CONTENT_ERROR);
        assertThat(log.getMailType()).isEqualTo("PRODUCT_DELIVERY");
        assertThat(log.getOrderNo()).isEqualTo(order.getOutTradeNo());
        assertThat(log.getProductId()).isEqualTo(product.getId());
    }

    private MailSendLog capturedLog() {
        ArgumentCaptor<MailSendLog> captured = ArgumentCaptor.forClass(MailSendLog.class);
        verify(mailSendLogMapper).insert(captured.capture());
        return captured.getValue();
    }

    private String extractText(Part part) throws Exception {
        Object content = part.getContent();
        if (content instanceof String text) return text;
        if (content instanceof Multipart multipart) {
            StringBuilder body = new StringBuilder();
            for (int index = 0; index < multipart.getCount(); index++) {
                body.append(extractText(multipart.getBodyPart(index)));
            }
            return body.toString();
        }
        return "";
    }
}
