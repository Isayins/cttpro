package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.UpdateProfileRequest;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceProfileTest {

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

    private User activeUser() {
        User user = new User();
        user.setId(7L);
        user.setNickname("旧昵称");
        user.setStatus("ACTIVE");
        return user;
    }
}
