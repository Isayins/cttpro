package com.idncar.service;

import com.idncar.mapper.UserNotificationMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    @Test
    void notificationHistoryUsesTheOldestLoadedIdAsCursor() {
        UserNotificationMapper mapper = mock(UserNotificationMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        NotificationService service = new NotificationService();
        when(mapper.selectList(any())).thenReturn(List.of());
        ReflectionTestUtils.setField(service, "userNotificationMapper", mapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);

        service.getNotifications(7L, 20, 99L);

        verify(userAccessService).requireActiveUser(7L);
        verify(mapper).selectList(argThat(query ->
                query.getSqlSegment().contains("id <")
                        && query.getSqlSegment().contains("ORDER BY id DESC")
                        && query.getSqlSegment().contains("LIMIT 20")
        ));
    }
}
