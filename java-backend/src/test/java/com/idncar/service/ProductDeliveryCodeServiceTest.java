package com.idncar.service;

import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.MailSendLogMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.entity.MailSendLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductDeliveryCode;
import com.idncar.service.impl.MailBrandTemplateHelper;
import com.idncar.service.ProductDeliveryCodeService;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;

import java.lang.reflect.Field;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductDeliveryCodeServiceTest {

    @Test
    void normalProductSendsDeliveryEmailWithoutLockingCdk() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("学习资料");
        product.setDescription("资料下载地址：https://example.com/download");
        product.setDeliveryType("NONE");

        PaymentOrder order = new PaymentOrder();
        order.setResourceId(1L);
        order.setOutTradeNo("FREE-ORDER-1");
        order.setPayerUserId(9L);
        order.setDeliveryEmail("buyer@example.com");

        ProductMapper productMapper = mock(ProductMapper.class);
        when(productMapper.selectById(1L)).thenReturn(product);
        UserMapper userMapper = mock(UserMapper.class);
        ProductDeliveryCodeMapper deliveryCodeMapper = mock(ProductDeliveryCodeMapper.class);
        MailSendLogMapper mailSendLogMapper = mock(MailSendLogMapper.class);

        JavaMailSender mailSender = mock(JavaMailSender.class);
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);

        MailBrandTemplateHelper templateHelper = new MailBrandTemplateHelper("https://idncar.com", "https://idncar.com/logo.png");

        ProductDeliveryCodeService service = new ProductDeliveryCodeService();
        setField(service, "productMapper", productMapper);
        setField(service, "userMapper", userMapper);
        setField(service, "productDeliveryCodeMapper", deliveryCodeMapper);
        setField(service, "mailSendLogMapper", mailSendLogMapper);
        setField(service, "mailSenderProvider", mailSenderProvider);
        setField(service, "mailBrandTemplateHelper", templateHelper);
        setField(service, "mailFrom", "sender@example.com");
        setField(service, "springMailUsername", "sender@example.com");
        setField(service, "mailMockEnabled", false);

        assertThat(service.fulfillPaidOrder(order)).isNull();
        verify(mailSender).send(mimeMessage);
        verify(deliveryCodeMapper, never()).selectOne(any());
        ArgumentCaptor<MailSendLog> logCaptor = ArgumentCaptor.forClass(MailSendLog.class);
        verify(mailSendLogMapper).insert(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo("SUCCESS");
        assertThat(logCaptor.getValue().getRecipientEmail()).isEqualTo("buyer@example.com");

        assertThat(mimeMessage.getAllRecipients()[0].toString()).isEqualTo("buyer@example.com");
        assertThat(mimeMessage.getSubject()).contains("学习资料");
        assertThat(extractText(mimeMessage))
                .contains("商品交付内容")
                .contains("https://example.com/download");
    }

    @Test
    void normalProductReportsMailConfigurationFailure() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("普通商品");
        product.setDeliveryType("NONE");

        PaymentOrder order = new PaymentOrder();
        order.setResourceId(1L);
        order.setOutTradeNo("FREE-ORDER-2");
        order.setDeliveryEmail("buyer@example.com");

        ProductMapper productMapper = mock(ProductMapper.class);
        when(productMapper.selectById(1L)).thenReturn(product);
        MailSendLogMapper mailSendLogMapper = mock(MailSendLogMapper.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        when(mailSenderProvider.getIfAvailable()).thenReturn(null);

        ProductDeliveryCodeService service = new ProductDeliveryCodeService();
        setField(service, "productMapper", productMapper);
        setField(service, "userMapper", mock(UserMapper.class));
        setField(service, "mailSendLogMapper", mailSendLogMapper);
        setField(service, "mailSenderProvider", mailSenderProvider);

        assertThat(service.fulfillPaidOrder(order))
                .isEqualTo("邮件服务未配置完成，商品发货邮件待后台发送");
        ArgumentCaptor<MailSendLog> logCaptor = ArgumentCaptor.forClass(MailSendLog.class);
        verify(mailSendLogMapper).insert(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(logCaptor.getValue().getErrorMessage()).contains("邮件服务未配置完成");
    }

    @Test
    void cdkOrderResendUsesExistingBoundCode() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("会员兑换卡");
        product.setDeliveryType("CDK_EMAIL");
        product.setDeliveryInstructions("前往会员中心兑换");

        PaymentOrder order = new PaymentOrder();
        order.setResourceId(1L);
        order.setOutTradeNo("PAID-ORDER-1");
        order.setPayerUserId(9L);
        order.setDeliveryEmail("buyer@example.com");

        ProductDeliveryCode deliveryCode = new ProductDeliveryCode();
        deliveryCode.setId(7L);
        deliveryCode.setProductId(1L);
        deliveryCode.setOrderNo("PAID-ORDER-1");
        deliveryCode.setCode("ORIGINAL-CDK-001");
        deliveryCode.setStatus("SENT");

        ProductMapper productMapper = mock(ProductMapper.class);
        when(productMapper.selectById(1L)).thenReturn(product);
        ProductDeliveryCodeMapper deliveryCodeMapper = mock(ProductDeliveryCodeMapper.class);
        MailSendLogMapper mailSendLogMapper = mock(MailSendLogMapper.class);
        when(deliveryCodeMapper.selectOne(any())).thenReturn(deliveryCode);
        when(deliveryCodeMapper.update(any(), any())).thenReturn(1);

        JavaMailSender mailSender = mock(JavaMailSender.class);
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mailSenderProvider = mock(ObjectProvider.class);
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);

        ProductDeliveryCodeService service = new ProductDeliveryCodeService();
        setField(service, "productMapper", productMapper);
        setField(service, "userMapper", mock(UserMapper.class));
        setField(service, "productDeliveryCodeMapper", deliveryCodeMapper);
        setField(service, "mailSendLogMapper", mailSendLogMapper);
        setField(service, "mailSenderProvider", mailSenderProvider);
        setField(service, "mailBrandTemplateHelper",
                new MailBrandTemplateHelper("https://idncar.com", "https://idncar.com/logo.png"));
        setField(service, "mailFrom", "sender@example.com");
        setField(service, "springMailUsername", "sender@example.com");
        setField(service, "mailMockEnabled", false);

        service.resendPaidOrder(order);

        verify(mailSender, times(1)).send(mimeMessage);
        verify(deliveryCodeMapper, times(1)).selectOne(any());
        verify(deliveryCodeMapper, times(1)).update(any(), any());
        assertThat(extractText(mimeMessage)).contains("ORIGINAL-CDK-001");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private String extractText(Part part) throws Exception {
        Object content = part.getContent();
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof Multipart multipart) {
            StringBuilder result = new StringBuilder();
            for (int index = 0; index < multipart.getCount(); index++) {
                result.append(extractText(multipart.getBodyPart(index)));
            }
            return result.toString();
        }
        return "";
    }
}
