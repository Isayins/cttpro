package com.idncar.util;

import io.jsonwebtoken.io.Decoders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Component
public class HotmailCredentialCrypto {

    private static final String ENCRYPTED_PREFIX = "enc::";
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_IV_BYTES = 12;

    private final SecretKeySpec secretKeySpec;
    private final SecureRandom secureRandom = new SecureRandom();

    public HotmailCredentialCrypto(
            @Value("${app.hotmail.encryption-secret:${jwt.secret}}") String configuredSecret
    ) {
        this.secretKeySpec = new SecretKeySpec(deriveKey(configuredSecret), "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        if (isEncrypted(plaintext)) {
            return plaintext;
        }

        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));

            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] payload = ByteBuffer.allocate(iv.length + cipherText.length)
                    .put(iv)
                    .put(cipherText)
                    .array();

            return ENCRYPTED_PREFIX + Base64.getEncoder().encodeToString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt Hotmail credential", e);
        }
    }

    public String decrypt(String storedValue) {
        if (storedValue == null || storedValue.isBlank()) {
            return storedValue;
        }
        if (!isEncrypted(storedValue)) {
            return storedValue;
        }

        try {
            byte[] payload = Base64.getDecoder().decode(storedValue.substring(ENCRYPTED_PREFIX.length()));
            byte[] iv = Arrays.copyOfRange(payload, 0, GCM_IV_BYTES);
            byte[] cipherText = Arrays.copyOfRange(payload, GCM_IV_BYTES, payload.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));

            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt Hotmail credential", e);
        }
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(ENCRYPTED_PREFIX);
    }

    private byte[] deriveKey(String configuredSecret) {
        try {
            byte[] rawSecret;
            try {
                rawSecret = Decoders.BASE64.decode(configuredSecret);
            } catch (Exception ignored) {
                rawSecret = configuredSecret.getBytes(StandardCharsets.UTF_8);
            }

            byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawSecret);
            return Arrays.copyOf(digest, 32);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize Hotmail credential crypto", e);
        }
    }
}
