package com.idncar.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Data
@Component
@ConfigurationProperties(prefix = "app.payment.alipay")
public class AlipayPaymentProperties {

    private boolean enabled = false;
    private String appId;
    private String privateKey;
    private String alipayPublicKey;
    private String gatewayUrl = "https://openapi.alipay.com/gateway.do";
    private String notifyUrl;
    private String signType = "RSA2";
    private String charset = "UTF-8";
    private String format = "json";
    private boolean encryptEnabled = true;
    private String encryptType = "AES";
    private String encryptKey;
    private String qrCodeTimeoutExpress = "30m";

    public boolean isConfigured() {
        return enabled
                && hasText(appId)
                && hasText(privateKey)
                && hasText(alipayPublicKey)
                && hasText(gatewayUrl)
                && hasText(notifyUrl)
                && isEncryptionConfigured();
    }

    public String normalizedPrivateKey() {
        return normalizeKey(privateKey);
    }

    public String normalizedAlipayPublicKey() {
        return normalizeKey(alipayPublicKey);
    }

    public String normalizedEncryptType() {
        if (encryptType == null) {
            return null;
        }
        return encryptType.trim().toUpperCase(Locale.ROOT);
    }

    public String normalizedEncryptKey() {
        if (encryptKey == null) {
            return null;
        }
        return encryptKey.replaceAll("\\s+", "");
    }

    private boolean isEncryptionConfigured() {
        return !encryptEnabled || (hasText(encryptType) && hasText(encryptKey));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return null;
        }
        return value
                .replace("\\n", "\n")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s+", "");
    }
}
