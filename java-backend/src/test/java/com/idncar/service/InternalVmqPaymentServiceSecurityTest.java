package com.idncar.service;

import com.idncar.mapper.PaymentVmqSettingMapper;
import com.idncar.model.entity.PaymentVmqSetting;
import com.idncar.service.InternalVmqPaymentService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InternalVmqPaymentServiceSecurityTest {

    private static final String KEY = "1234567890abcdef1234567890abcdef";
    private static final String EVENT_ID = "a".repeat(64);

    @Test
    void appPushRequiresFreshSignedEventMetadata() throws Exception {
        InternalVmqPaymentService service = service();
        long now = Instant.now().getEpochSecond();

        Map<String, String> valid = signedParams(now - 1, now);
        assertThat(service.verifyAppPush(valid)).isTrue();

        Map<String, String> missingEventMetadata = new HashMap<>(valid);
        missingEventMetadata.remove("eventId");
        assertThat(service.verifyAppPush(missingEventMetadata)).isFalse();

        Map<String, String> staleSignature = signedParams(now - 1, now - 600);
        assertThat(service.verifyAppPush(staleSignature)).isFalse();

        Map<String, String> stalePaymentEvent = signedParams(now - 90_000, now);
        assertThat(service.verifyAppPush(stalePaymentEvent)).isFalse();
    }

    private InternalVmqPaymentService service() throws Exception {
        PaymentVmqSetting setting = new PaymentVmqSetting();
        setting.setId(1L);
        setting.setEnabled(true);
        setting.setPreferred(true);
        setting.setPayType(2);
        setting.setCommunicationKey(KEY);
        setting.setAmountStrategy("INCREASE");
        setting.setOrderTimeoutMinutes(5);
        setting.setMonitorState("ONLINE");

        PaymentVmqSettingMapper mapper = mock(PaymentVmqSettingMapper.class);
        when(mapper.selectById(1L)).thenReturn(setting);

        InternalVmqPaymentService service = new InternalVmqPaymentService();
        setField(service, "paymentVmqSettingMapper", mapper);
        return service;
    }

    private Map<String, String> signedParams(long paidAt, long requestTime) throws Exception {
        String type = "2";
        String price = "0.01";
        String paidAtText = String.valueOf(paidAt);
        String requestTimeText = String.valueOf(requestTime);
        String mode = "LIVE";
        Map<String, String> params = new HashMap<>();
        params.put("type", type);
        params.put("price", price);
        params.put("paidAt", paidAtText);
        params.put("eventId", EVENT_ID);
        params.put("mode", mode);
        params.put("t", requestTimeText);
        params.put("sign", md5(type + price + paidAtText + EVENT_ID + mode + requestTimeText + KEY));
        return params;
    }

    private String md5(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
