package com.idncar.service;

import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ChangePasswordRequest;
import com.idncar.model.entity.User;
import com.idncar.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServicePasswordChangeTest {

    @Test
    void passwordChangeInvalidatesTheExistingSession() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        @SuppressWarnings("unchecked")
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, Object> values = mock(ValueOperations.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "redisTemplate", redisTemplate);
        ReflectionTestUtils.setField(service, "jwtUtil", jwtUtil);

        User user = new User();
        user.setId(7L);
        user.setPassword(new BCryptPasswordEncoder().encode("old123"));
        when(userAccessService.requireActiveUser(7L)).thenReturn(user);
        when(redisTemplate.opsForValue()).thenReturn(values);
        when(values.get("token:7")).thenReturn("old-token");
        when(jwtUtil.getExpirationTime()).thenReturn(60_000L);
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("old123");
        request.setNewPassword("new123");
        request.setConfirmPassword("new123");

        service.changePassword(7L, request);

        assertThat(new BCryptPasswordEncoder().matches("new123", user.getPassword())).isTrue();
        verify(userMapper).updateById(user);
        verify(values).set("token:blacklist:old-token", "1", 60_000L, TimeUnit.MILLISECONDS);
        verify(redisTemplate).delete("token:7");
    }
}
