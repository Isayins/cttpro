package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.CreatePrivateChatMessageRequest;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CommunityServiceTest {

    @Test
    void clearingAChatRoomRequiresAdminBeforeDeletingMessages() {
        CommunityService service = new CommunityService();
        UserAccessService userAccessService = mock(UserAccessService.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbcTemplate);

        service.clearChatMessages(7L, " general ");

        var ordered = inOrder(userAccessService, jdbcTemplate);
        ordered.verify(userAccessService).requireAdmin(7L);
        ordered.verify(jdbcTemplate).update("DELETE FROM community_chat_messages WHERE room_id = ?", "general");
    }

    @Test
    void blockedUsersCannotSendPrivateMessagesInEitherDirection() {
        CommunityService service = new CommunityService();
        UserAccessService userAccessService = mock(UserAccessService.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        User sender = new User();
        sender.setId(7L);
        when(userAccessService.requireActiveUser(7L)).thenReturn(sender);
        when(userAccessService.requireActiveUser(9L)).thenReturn(new User());
        when(jdbcTemplate.queryForObject(
                anyString(),
                eq(Integer.class),
                eq(7L),
                eq(9L),
                eq(9L),
                eq(7L)
        )).thenReturn(1);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbcTemplate);

        assertThatThrownBy(() -> service.createPrivateMessage(
                7L,
                new CreatePrivateChatMessageRequest(9L, "hello")
        )).isInstanceOf(ApiException.class)
                .hasMessage("你们之间已启用屏蔽，无法发送消息");
    }
}
