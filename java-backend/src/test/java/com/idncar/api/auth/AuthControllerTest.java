package com.idncar.api.auth;

import com.idncar.model.dto.LoginRequest;
import com.idncar.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuthControllerTest {

    @Test
    void loginPrefersTrustedRealIpOverForwardedChain() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = controllerWith(authService);
        LoginRequest loginRequest = new LoginRequest();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "203.0.113.10");
        request.addHeader("X-Forwarded-For", "198.51.100.99, 203.0.113.10");
        request.addHeader("User-Agent", "test-agent");

        controller.login(loginRequest, request);

        verify(authService).login(eq(loginRequest), eq("203.0.113.10"), eq("test-agent"));
    }

    @Test
    void loginFallsBackToConnectionAddressWithoutTrustedProxyHeader() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = controllerWith(authService);
        LoginRequest loginRequest = new LoginRequest();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        controller.login(loginRequest, request);

        verify(authService).login(eq(loginRequest), eq("127.0.0.1"), eq(null));
    }

    private AuthController controllerWith(AuthService authService) {
        AuthController controller = new AuthController();
        ReflectionTestUtils.setField(controller, "authService", authService);
        return controller;
    }
}
