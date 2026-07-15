package com.idncar.service;

import com.idncar.model.dto.CreateDownloadResourceRequest;
import com.idncar.service.impl.AdminServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class AdminServiceImplDownloadPasswordTest {

    private final AdminServiceImpl service = new AdminServiceImpl();

    @Test
    void newDownloadPasswordIsHashedAndExistingHashCanBePreserved() throws Exception {
        CreateDownloadResourceRequest request = new CreateDownloadResourceRequest();
        request.setPasswordProtected(true);
        request.setDownloadPassword("resource-pass-123");

        String hash = resolvePasswordHash(request, null);

        assertThat(hash).isNotEqualTo("resource-pass-123");
        assertThat(new BCryptPasswordEncoder().matches("resource-pass-123", hash)).isTrue();

        request.setDownloadPassword(" ");
        assertThat(resolvePasswordHash(request, hash)).isEqualTo(hash);
    }

    @Test
    void disablingPasswordProtectionClearsExistingHash() throws Exception {
        CreateDownloadResourceRequest request = new CreateDownloadResourceRequest();
        request.setPasswordProtected(false);

        assertThat(resolvePasswordHash(request, "existing-hash")).isNull();
    }

    private String resolvePasswordHash(CreateDownloadResourceRequest request, String currentHash) throws Exception {
        Method method = AdminServiceImpl.class.getDeclaredMethod(
                "resolveDownloadPasswordHash",
                CreateDownloadResourceRequest.class,
                String.class
        );
        method.setAccessible(true);
        return (String) method.invoke(service, request, currentHash);
    }
}
