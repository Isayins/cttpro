package com.idncar.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;

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
}
