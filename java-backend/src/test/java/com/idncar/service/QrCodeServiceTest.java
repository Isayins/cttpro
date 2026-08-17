package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.QrCodeMapper;
import com.idncar.mapper.QrScanLogMapper;
import com.idncar.model.dto.QrCodeAccessRequest;
import com.idncar.model.dto.QrCodeAccessResponse;
import com.idncar.model.dto.QrCodeDto;
import com.idncar.model.dto.QrCodePublicDto;
import com.idncar.model.dto.SaveQrCodeRequest;
import com.idncar.model.entity.QrCode;
import com.idncar.model.entity.QrScanLog;
import com.idncar.model.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
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
        assertThat(result.getTargetUrl()).isNull();
        assertThat(result.getHtmlContent()).isEqualTo(request.getHtmlContent());
        assertThat(inserted.get().getTargetUrl()).isNull();
        assertThat(inserted.get().getCreatedBy()).isEqualTo(1L);
    }

    @Test
    void countsRepeatedAccessIdOnlyOnce() {
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

        QrCodeAccessRequest request = new QrCodeAccessRequest();
        request.setAccessId("access_same-request");
        when(qrScanLogMapper.insert(any(QrScanLog.class)))
                .thenReturn(1)
                .thenThrow(new DuplicateKeyException("duplicate access id"));

        QrCodeAccessResponse firstResult = service.accessQrCode(
                "counter1",
                request,
                null,
                httpRequest
        );
        QrCodeAccessResponse repeatedResult = service.accessQrCode(
                "counter1",
                request,
                null,
                httpRequest
        );

        verify(qrScanLogMapper, times(2)).insert(any(QrScanLog.class));
        verify(qrCodeMapper, times(1)).update(isNull(), any());
        assertThat(firstResult.getContentType()).isEqualTo("HTML");
        assertThat(firstResult.getHtmlContent()).isEqualTo("<h1>counter</h1>");
        assertThat(firstResult.getTotalScanCount()).isEqualTo(12L);
        assertThat(repeatedResult.getTotalScanCount()).isEqualTo(12L);
    }

    @Test
    void exposesLoginAndAccessCodeAsAvailablePublicPrerequisites() {
        QrCodeMapper qrCodeMapper = mock(QrCodeMapper.class);
        QrCode loginQrCode = activeQrCode("login1");
        loginQrCode.setLoginRequired(true);
        QrCode accessCodeQrCode = activeQrCode("code01");
        accessCodeQrCode.setAccessCodeRequired(true);
        when(qrCodeMapper.selectOne(any())).thenReturn(loginQrCode, accessCodeQrCode);
        QrCodeService service = service(qrCodeMapper, mock(QrScanLogMapper.class), mock(UserAccessService.class));

        QrCodePublicDto loginInfo = service.getPublicQrCode("login1", null);
        QrCodePublicDto accessCodeInfo = service.getPublicQrCode("code01", null);

        assertThat(loginInfo.getAvailable()).isTrue();
        assertThat(loginInfo.getUnavailableReason()).isNull();
        assertThat(loginInfo.getLoginRequired()).isTrue();
        assertThat(accessCodeInfo.getAvailable()).isTrue();
        assertThat(accessCodeInfo.getUnavailableReason()).isNull();
        assertThat(accessCodeInfo.getAccessCodeRequired()).isTrue();
    }

    @Test
    void omitsHtmlFromAdminListAndIncludesItInDetail() {
        QrCodeMapper qrCodeMapper = mock(QrCodeMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        User operator = new User();
        operator.setId(1L);
        QrCode qrCode = activeQrCode("counter1");
        qrCode.setHtmlContent("<h1>counter</h1>");
        when(userAccessService.requireAdmin(1L)).thenReturn(operator);
        when(qrCodeMapper.selectList(any())).thenReturn(List.of(qrCode));
        when(qrCodeMapper.selectById(8L)).thenReturn(qrCode);
        when(jdbcTemplate.queryForList(any(String.class), any(Object[].class))).thenReturn(List.of());
        QrCodeService service = service(qrCodeMapper, mock(QrScanLogMapper.class), userAccessService);
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbcTemplate);

        List<QrCodeDto> list = service.getAdminQrCodes(1L);
        QrCodeDto detail = service.getAdminQrCode(1L, 8L);

        assertThat(list).singleElement().extracting(QrCodeDto::getHtmlContent).isNull();
        assertThat(detail.getHtmlContent()).isEqualTo("<h1>counter</h1>");
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

    private QrCode activeQrCode(String shortCode) {
        QrCode qrCode = new QrCode();
        qrCode.setId(8L);
        qrCode.setShortCode(shortCode);
        qrCode.setContentType("HTML");
        qrCode.setStatus("ACTIVE");
        qrCode.setLoginRequired(false);
        qrCode.setAccessCodeRequired(false);
        return qrCode;
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
