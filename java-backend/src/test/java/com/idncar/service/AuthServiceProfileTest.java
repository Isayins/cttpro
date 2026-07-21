package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.InviteCodeMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.RegisterRequest;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.entity.InviteCode;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceProfileTest {

    @Test
    @SuppressWarnings("unchecked")
    void registerStartsWithEmptyOptionalProfileFields() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        InviteCodeMapper inviteCodeMapper = mock(InviteCodeMapper.class);
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        ValueOperations<String, Object> valueOperations = mock(ValueOperations.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "inviteCodeMapper", inviteCodeMapper);
        ReflectionTestUtils.setField(service, "redisTemplate", redisTemplate);

        InviteCode inviteCode = new InviteCode();
        inviteCode.setStatus("ACTIVE");
        inviteCode.setReusable(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("email:register:code:new@example.com")).thenReturn("123456");
        when(inviteCodeMapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(inviteCode);

        RegisterRequest request = new RegisterRequest();
        request.setUsername("new-user");
        request.setEmail("new@example.com");
        request.setPassword("pass123");
        request.setNickname("新用户");
        request.setInviteCode("invite");
        request.setEmailCode("123456");

        service.register(request);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(userCaptor.capture());
        assertThat(userCaptor.getValue().getAvatarUrl()).isNull();
        assertThat(userCaptor.getValue().getBio()).isNull();
    }

    @Test
    void updateProfileNormalizesValuesBeforePersisting() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);

        User user = activeUser();
        when(userAccessService.requireActiveUser(7L)).thenReturn(user);
        when(userMapper.selectById(7L)).thenReturn(user);
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("  新昵称  ");
        request.setAvatarUrl("  /api/uploads/avatars/user-7.jpg  ");
        request.setBio("   ");

        service.updateProfile(7L, request);

        assertThat(user.getNickname()).isEqualTo("新昵称");
        assertThat(user.getAvatarUrl()).isEqualTo("/api/uploads/avatars/user-7.jpg");
        assertThat(user.getBio()).isNull();
        verify(userMapper).updateById(user);
    }

    @Test
    void updateProfileRejectsInvalidValuesBeforePersisting() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);

        User user = activeUser();
        when(userAccessService.requireActiveUser(7L)).thenReturn(user);
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNickname("a".repeat(51));

        assertThatThrownBy(() -> service.updateProfile(7L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("昵称不能超过 50 个字符");
        verify(userMapper, never()).updateById(user);
    }

    @Test
    void updateProfileClearsAvatarInsteadOfGeneratingRemoteFallback() {
        AuthService service = new AuthService();
        UserMapper userMapper = mock(UserMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "uploadBaseDir", "uploads");
        ReflectionTestUtils.setField(service, "uploadAvatarSubDir", "avatars");

        User user = activeUser();
        user.setAvatarUrl("https://api.dicebear.com/9.x/initials/svg?seed=Old");
        when(userAccessService.requireActiveUser(7L)).thenReturn(user);
        when(userMapper.selectById(7L)).thenReturn(user);
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setAvatarUrl("  ");

        service.updateProfile(7L, request);

        assertThat(user.getAvatarUrl()).isNull();
        verify(userMapper).updateById(user);
    }

    private User activeUser() {
        User user = new User();
        user.setId(7L);
        user.setNickname("旧昵称");
        user.setStatus("ACTIVE");
        return user;
    }
}
