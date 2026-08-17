package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.QrCodeMapper;
import com.idncar.mapper.QrScanLogMapper;
import com.idncar.model.dto.QrCodeAccessRequest;
import com.idncar.model.dto.QrCodeAccessResponse;
import com.idncar.model.dto.QrCodeDto;
import com.idncar.model.dto.SaveQrCodeRequest;
import com.idncar.model.entity.QrCode;
import com.idncar.model.entity.QrScanLog;
import com.idncar.model.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QrCodeServiceTest {

    @Test
    void createsHtmlQrCodeAndPreservesItsExecutableDocument() {
        QrCodeMapper qrCodeMapper = mock(QrCodeMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        AtomicReference<QrCode> inserted = new AtomicReference<>();
        User operator = new User();
        operator.setId(1L);
        operator.setRole("ADMIN");
        when(userAccessService.requireAdmin(1L)).thenReturn(operator);
        when(qrCodeMapper.selectOne(any())).thenReturn(null);
        when(qrCodeMapper.insert(any(QrCode.class))).thenAnswer(invocation -> {
            QrCode qrCode = invocation.getArgument(0);
            qrCode.setId(8L);
            inserted.set(qrCode);
            return 1;
        });
        when(qrCodeMapper.selectById(8L)).thenAnswer(invocation -> inserted.get());
        QrCodeService service = service(qrCodeMapper, mock(QrScanLogMapper.class), userAccessService);

        SaveQrCodeRequest request = htmlRequest("<script>document.title='ok'</script>");
        QrCodeDto result = service.createQrCode(1L, request);

        assertThat(result.getContentType()).isEqualTo("HTML");
        assertThat(result.getTargetUrl()).isEmpty();
        assertThat(result.getHtmlContent()).isEqualTo(request.getHtmlContent());
        assertThat(inserted.get().getCreatedBy()).isEqualTo(1L);
    }

    @Test
    void returnsUpdatedScanCountWithHtmlPageAfterRecordingAccess() {
        QrCodeMapper qrCodeMapper = mock(QrCodeMapper.class);
        QrScanLogMapper qrScanLogMapper = mock(QrScanLogMapper.class);
        QrCode qrCode = new QrCode();
        qrCode.setId(8L);
        qrCode.setShortCode("counter1");
        qrCode.setContentType("HTML");
        qrCode.setHtmlContent("<h1>counter</h1>");
        qrCode.setTargetUrl("");
        qrCode.setStatus("ACTIVE");
        qrCode.setLoginRequired(false);
        qrCode.setAccessCodeRequired(false);
        when(qrCodeMapper.selectOne(any())).thenReturn(qrCode);
        when(qrCodeMapper.update(isNull(), any())).thenReturn(1);
        QrCode updatedQrCode = new QrCode();
        updatedQrCode.setTotalScanCount(12L);
        when(qrCodeMapper.selectById(8L)).thenReturn(updatedQrCode);
        QrCodeService service = service(qrCodeMapper, qrScanLogMapper, mock(UserAccessService.class));
        HttpServletRequest httpRequest = mock(HttpServletRequest.class);

        QrCodeAccessResponse result = service.accessQrCode(
                "counter1",
                new QrCodeAccessRequest(),
                null,
                httpRequest
        );

        verify(qrScanLogMapper).insert(any(QrScanLog.class));
        verify(qrCodeMapper).update(isNull(), any());
        assertThat(result.getContentType()).isEqualTo("HTML");
        assertThat(result.getHtmlContent()).isEqualTo("<h1>counter</h1>");
        assertThat(result.getScanCount()).isEqualTo(12L);
    }

    @Test
    void rejectsOversizedHtmlPage() {
        QrCodeMapper qrCodeMapper = mock(QrCodeMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        User operator = new User();
        operator.setId(1L);
        when(userAccessService.requireAdmin(1L)).thenReturn(operator);
        when(qrCodeMapper.selectOne(any())).thenReturn(null);
        QrCodeService service = service(qrCodeMapper, mock(QrScanLogMapper.class), userAccessService);

        SaveQrCodeRequest request = htmlRequest("x".repeat(200_001));

        assertThatThrownBy(() -> service.createQrCode(1L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("HTML 页面内容不能超过 200000 个字符");
    }

    private SaveQrCodeRequest htmlRequest(String htmlContent) {
        SaveQrCodeRequest request = new SaveQrCodeRequest();
        request.setTitle("扫码计数");
        request.setShortCode("counter1");
        request.setContentType("HTML");
        request.setHtmlContent(htmlContent);
        request.setStatus("ACTIVE");
        return request;
    }

    private QrCodeService service(QrCodeMapper qrCodeMapper,
                                  QrScanLogMapper qrScanLogMapper,
                                  UserAccessService userAccessService) {
        QrCodeService service = new QrCodeService();
        ReflectionTestUtils.setField(service, "qrCodeMapper", qrCodeMapper);
        ReflectionTestUtils.setField(service, "qrScanLogMapper", qrScanLogMapper);
        ReflectionTestUtils.setField(service, "userAccessService", userAccessService);
        ReflectionTestUtils.setField(service, "adminOperationLogMapper", mock(AdminOperationLogMapper.class));
        return service;
    }
}
