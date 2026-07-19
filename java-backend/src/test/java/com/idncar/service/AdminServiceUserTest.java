package com.idncar.service;

import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AdminUpdateUserRequest;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminServiceUserTest {

    @Test
    void disablingUserRevokesTheirSessionWithoutDeletingData() {
        AdminService service = new AdminService();
        UserAccessService userAccessService = mock(UserAccessService.class);
        UserMapper userMapper = mock(UserMapper.class);
        AuthService authService = mock(AuthService.class);
        User operator = user(1L, "OWNER", "ACTIVE");
        User target = user(7L, "USER", "ACTIVE");
        when(userAccessService.requireAdmin(1L)).thenReturn(operator);
        when(userMapper.selectById(7L)).thenReturn(target);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "userMapper", userMapper);
        ReflectionTestUtils.setField(service, "authService", authService);
        ReflectionTestUtils.setField(service, "adminOperationLogMapper", mock(AdminOperationLogMapper.class));

        AdminUpdateUserRequest request = new AdminUpdateUserRequest();
        request.setStatus("DISABLED");
        service.updateUser(1L, 7L, request);

        verify(userMapper).updateById(target);
        verify(authService).invalidateUserSession(7L);
    }

    private User user(Long id, String role, String status) {
        User user = new User();
        user.setId(id);
        user.setNickname("用户" + id);
        user.setRole(role);
        user.setStatus(status);
        return user;
    }
}
