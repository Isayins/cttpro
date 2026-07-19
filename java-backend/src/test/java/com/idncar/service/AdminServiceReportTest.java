package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.PostReportMapper;
import com.idncar.model.dto.ReviewPostReportRequest;
import com.idncar.model.entity.PostReport;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminServiceReportTest {

    @Test
    void deletingReportedContentRequiresResolvedStatus() {
        AdminService service = new AdminService();
        UserAccessService userAccessService = mock(UserAccessService.class);
        PostReportMapper postReportMapper = mock(PostReportMapper.class);
        User operator = new User();
        operator.setId(7L);
        PostReport report = new PostReport();
        report.setId(12L);
        report.setTargetType("CHAT_MESSAGE");
        report.setTargetId(18L);
        when(userAccessService.requireAdmin(7L)).thenReturn(operator);
        when(postReportMapper.selectById(12L)).thenReturn(report);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "postReportMapper", postReportMapper);

        ReviewPostReportRequest request = new ReviewPostReportRequest();
        request.setStatus("REJECTED");
        request.setDeleteTarget(true);

        assertThatThrownBy(() -> service.reviewPostReport(7L, 12L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("删除举报内容时，处理状态必须为已处理");
    }
}
