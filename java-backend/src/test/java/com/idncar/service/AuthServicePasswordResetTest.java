package com.idncar.service;

import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ResetPasswordRequest;
import com.idncar.model.dto.SendEmailCodeRequest;
import com.idncar.model.dto.SendEmailCodeResponse;
import com.idncar.model.entity.User;
import com.idncar.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServicePasswordResetTest {

    @Test
    void passwordResetCodeDoesNotRevealWhetherEmailExists() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> values = mock(ValueOperations.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "redisTemplate", redisTemplate);
        ReflectionTestUtils.setField(service, "emailCodeCooldownSeconds", 60L);
        when(redisTemplate.opsForValue()).thenReturn(values);

        SendEmailCodeRequest request = new SendEmailCodeRequest();
        request.setEmail("missing@example.com");
        SendEmailCodeResponse response = service.sendPasswordResetEmailCode(request);

        assertThat(response.getMessage()).isEqualTo("如果该邮箱已注册，验证码邮件将发送到该邮箱");
        assertThat(response.getDebugCode()).isNull();
        verify(values).set(
                "email:password-reset:cooldown:missing@example.com",
                "1",
                60L,
                TimeUnit.SECONDS
        );
    }

    @Test
    void resetPasswordConsumesCodeAndInvalidatesTheExistingSession() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> values = mock(ValueOperations.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "redisTemplate", redisTemplate);
        ReflectionTestUtils.setField(service, "jwtUtil", jwtUtil);

        User user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setStatus("ACTIVE");
        user.setPassword(new BCryptPasswordEncoder().encode("old123"));
        when(userMapper.selectByEmail("user@example.com")).thenReturn(user);
        when(redisTemplate.opsForValue()).thenReturn(values);
        when(values.get("email:password-reset:code:user@example.com")).thenReturn("123456");
        when(values.get("token:7")).thenReturn("old-token");
        when(jwtUtil.getExpirationTime()).thenReturn(60_000L);

        service.resetPassword(new ResetPasswordRequest("user@example.com", "123456", "new123", "new123"));

        assertThat(new BCryptPasswordEncoder().matches("new123", user.getPassword())).isTrue();
        verify(userMapper).updateById(user);
        verify(redisTemplate).delete("email:password-reset:code:user@example.com");
        verify(redisTemplate).delete("email:password-reset:cooldown:user@example.com");
        verify(redisTemplate).delete("email:password-reset:attempts:user@example.com");
        verify(values).set("token:blacklist:old-token", "1", 60_000L, TimeUnit.MILLISECONDS);
        verify(redisTemplate).delete("token:7");
    }

    @Test
    void fifthInvalidCodeAttemptInvalidatesTheCode() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> values = mock(ValueOperations.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "redisTemplate", redisTemplate);

        User user = new User();
        user.setStatus("ACTIVE");
        when(userMapper.selectByEmail("user@example.com")).thenReturn(user);
        when(redisTemplate.opsForValue()).thenReturn(values);
        when(values.get("email:password-reset:code:user@example.com")).thenReturn("123456");
        when(values.increment("email:password-reset:attempts:user@example.com")).thenReturn(5L);

        assertThatThrownBy(() -> service.resetPassword(
                new ResetPasswordRequest("user@example.com", "654321", "new123", "new123")
        )).isInstanceOf(RuntimeException.class).hasMessage("邮箱验证码错误或已过期");
        verify(redisTemplate).delete("email:password-reset:code:user@example.com");
    }
}
