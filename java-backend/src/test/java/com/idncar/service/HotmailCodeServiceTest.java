package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.HotmailAccountMapper;
import com.idncar.model.dto.HotmailAccountDto;
import com.idncar.model.dto.ImportHotmailAccountsResponse;
import com.idncar.model.entity.HotmailAccount;
import com.idncar.util.HotmailCredentialCrypto;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Date;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HotmailCodeServiceTest {

    private final HotmailCodeService service = new HotmailCodeService();

    @Test
    void parseImportLineAcceptsTrailingStatusPart() throws Exception {
        Object parsed = parse("example@hotmail.com----pass-1----9e5f94bc-e8a4-4e73-b8be-63364c29d753----refresh-token$$----0");

        assertThat(value(parsed, "email")).isEqualTo("example@hotmail.com");
        assertThat(value(parsed, "password")).isEqualTo("pass-1");
        assertThat(value(parsed, "clientId")).isEqualTo("9e5f94bc-e8a4-4e73-b8be-63364c29d753");
        assertThat(value(parsed, "refreshToken")).isEqualTo("refresh-token");
        assertThat(value(parsed, "error")).isNull();
    }

    @Test
    void parseImportLineAcceptsDuplicatedExporterFields() throws Exception {
        Object parsed = parse("example@hotmail.com----old-pass----old-client----example@hotmail.com----new-pass----new-client----refresh-token----0");

        assertThat(value(parsed, "email")).isEqualTo("example@hotmail.com");
        assertThat(value(parsed, "password")).isEqualTo("new-pass");
        assertThat(value(parsed, "clientId")).isEqualTo("new-client");
        assertThat(value(parsed, "refreshToken")).isEqualTo("refresh-token");
        assertThat(value(parsed, "error")).isNull();
    }

    @Test
    void parseImportLineKeepsLegacyRefreshTokenDelimiters() throws Exception {
        Object parsed = parse("example@hotmail.com----pass-1----client-id----refresh----token");

        assertThat(value(parsed, "refreshToken")).isEqualTo("refresh----token");
    }

    @Test
    void credentialDecryptFailureGetsItsOwnTokenCheckStatus() throws Exception {
        assertThat(invoke(
                "resolveTokenCheckStatus",
                new Class<?>[]{boolean.class, boolean.class, boolean.class, boolean.class, boolean.class},
                false, false, false, true, false
        )).isEqualTo("CREDENTIAL_DECRYPT_FAILED");
    }

    @Test
    void accountCheckDoesNotReportCredentialDecryptFailureAsInvalidToken() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        HotmailCredentialCrypto hotmailCredentialCrypto = mock(HotmailCredentialCrypto.class);
        when(hotmailCredentialCrypto.decrypt(any()))
                .thenThrow(new IllegalStateException("Failed to decrypt Hotmail credential"));
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("hotmailCredentialCrypto", hotmailCredentialCrypto);

        HotmailAccount account = new HotmailAccount();
        account.setId(7L);
        account.setUserId(3L);
        account.setEmail("legacy@hotmail.com");
        account.setRefreshToken("enc::legacy-data");

        HotmailAccountDto result = (HotmailAccountDto) invoke(
                "checkAccountTokenScopes",
                new Class<?>[]{HotmailAccount.class},
                account
        );

        assertThat(result.getTokenCheckStatus()).isEqualTo("CREDENTIAL_DECRYPT_FAILED");
        assertThat(result.getTokenCheckSummary()).contains("凭据解密失败");
        verify(hotmailAccountMapper).updateById(account);
    }

    @Test
    void accountCheckClassifiesMicrosoftServiceAbuseModeSeparately() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        HotmailCredentialCrypto hotmailCredentialCrypto = mock(HotmailCredentialCrypto.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(hotmailCredentialCrypto.decrypt(anyString())).thenReturn("refresh-token");
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenThrow(ApiException.badGateway("Token refresh request failed: service_abuse_mode"));
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("hotmailCredentialCrypto", hotmailCredentialCrypto);
        setField("restTemplate", restTemplate);

        HotmailAccount account = new HotmailAccount();
        account.setId(8L);
        account.setUserId(3L);
        account.setEmail("abuse@hotmail.com");
        account.setClientId("client-id");
        account.setRefreshToken("enc::current-data");

        HotmailAccountDto result = (HotmailAccountDto) invoke(
                "checkAccountTokenScopes",
                new Class<?>[]{HotmailAccount.class},
                account
        );

        assertThat(result.getTokenCheckStatus()).isEqualTo("SERVICE_ABUSE_MODE");
        assertThat(result.getTokenCheckSummary()).contains("微软风控");
        verify(hotmailAccountMapper).updateById(account);
    }

    @Test
    void microsoftServiceAbuseSuberrorIsPreservedFromTokenResponse() throws Exception {
        String responseBody = """
                {"error":"invalid_grant","error_description":"The request was denied.","suberror":"service_abuse_mode"}
                """;
        RestClientResponseException exception = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                HttpHeaders.EMPTY,
                responseBody.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );

        assertThat(invoke(
                "getResponseErrorText",
                new Class<?>[]{RestClientResponseException.class},
                exception
        )).asString().contains("service_abuse_mode");
    }

    @Test
    void generatedPublicCodeTokenUsesThirdPartyLikeHexShape() throws Exception {
        String token = (String) invoke("generatePublicCodeToken");

        assertThat(token).matches("^[0-9a-f]{32}$");
    }

    @Test
    void generatedPublicCodeUidUsesThirdPartyLikeHexShape() throws Exception {
        String uid = (String) invoke("generatePublicCodeUid");

        assertThat(uid).matches("^[0-9a-f]{20}$");
    }

    @Test
    void publicFetchTokenMustUseGeneratedHexShape() throws Exception {
        assertThat(invoke("normalizePublicCodeFetchToken", "00574647c0c6a9d1489c360253c0e35d"))
                .isEqualTo("00574647c0c6a9d1489c360253c0e35d");

        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchToken", "short-token"))
                .hasCauseInstanceOf(ApiException.class);
        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchToken", "00574647c0c6a9d1489c360253c0e35D"))
                .hasCauseInstanceOf(ApiException.class);
        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchToken", "00574647c0c6a9d1489c360253c0e3__"))
                .hasCauseInstanceOf(ApiException.class);
    }

    @Test
    void legacyPublicTokenStillAcceptsUrlSafeTokenShape() throws Exception {
        String legacyToken = "oVSt-fI7Dxr_d66pAkVkuwnkGHDtNXPD";

        assertThat(invoke("normalizePublicCodeToken", legacyToken)).isEqualTo(legacyToken);
    }

    @Test
    void legacyPublicTokenRejectsNewHexFetchTokenShape() {
        assertThatThrownBy(() -> invoke("normalizePublicCodeToken", "00574647c0c6a9d1489c360253c0e35d"))
                .hasCauseInstanceOf(ApiException.class);
    }

    @Test
    void publicFetchUidMustUseGeneratedHexShape() throws Exception {
        assertThat(invoke("normalizePublicCodeFetchUid", "aa0661e4a22b61d20ec0"))
                .isEqualTo("aa0661e4a22b61d20ec0");

        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchUid", "aa0661e4"))
                .hasCauseInstanceOf(ApiException.class);
        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchUid", "AA0661e4a22b61d20ec0"))
                .hasCauseInstanceOf(ApiException.class);
        assertThatThrownBy(() -> invoke("normalizePublicCodeFetchUid", "aa0661e4a22b61d20e_"))
                .hasCauseInstanceOf(ApiException.class);
    }

    @Test
    void importAccountsAppliesDefaultGroupToNewAccounts() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        HotmailCredentialCrypto hotmailCredentialCrypto = mock(HotmailCredentialCrypto.class);
        when(hotmailCredentialCrypto.encrypt(anyString())).thenAnswer(invocation -> "enc:" + invocation.getArgument(0));
        when(hotmailAccountMapper.selectOne(any())).thenReturn(null);
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("userAccessService", userAccessService);
        setField("hotmailCredentialCrypto", hotmailCredentialCrypto);

        ImportHotmailAccountsResponse response = service.importAccounts(
                3L,
                "example@hotmail.com----pass-1----client-id----refresh-token",
                " GPT 7月新号 "
        );

        ArgumentCaptor<HotmailAccount> accountCaptor = ArgumentCaptor.forClass(HotmailAccount.class);
        verify(hotmailAccountMapper).insert(accountCaptor.capture());
        assertThat(response.getImported()).isEqualTo(1);
        assertThat(accountCaptor.getValue().getGroupName()).isEqualTo("GPT 7月新号");
        verify(userAccessService).requireActiveUser(3L);
    }

    @Test
    void importAccountsReportsBatchAndExistingDuplicates() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        HotmailCredentialCrypto hotmailCredentialCrypto = mock(HotmailCredentialCrypto.class);
        when(hotmailCredentialCrypto.encrypt(anyString())).thenAnswer(invocation -> "enc:" + invocation.getArgument(0));

        HotmailAccount sameBatchAccount = new HotmailAccount();
        sameBatchAccount.setId(11L);
        sameBatchAccount.setEmail("batch@hotmail.com");
        HotmailAccount existingAccount = new HotmailAccount();
        existingAccount.setId(12L);
        existingAccount.setEmail("existing@hotmail.com");
        existingAccount.setGroupName("原有分组");
        when(hotmailAccountMapper.selectOne(any())).thenReturn(null, sameBatchAccount, existingAccount);
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("userAccessService", userAccessService);
        setField("hotmailCredentialCrypto", hotmailCredentialCrypto);

        ImportHotmailAccountsResponse response = service.importAccounts(
                3L,
                String.join("\n",
                        "batch@hotmail.com----pass-1----client-id----refresh-1",
                        "BATCH@HOTMAIL.COM----pass-2----client-id----refresh-2",
                        "existing@hotmail.com----pass-3----client-id----refresh-3"),
                "新建分组"
        );

        assertThat(response.getImported()).isEqualTo(3);
        assertThat(response.getSkipped()).isZero();
        assertThat(response.getDuplicateCount()).isEqualTo(2);
        assertThat(response.getBatchDuplicateCount()).isEqualTo(1);
        assertThat(response.getExistingDuplicateCount()).isEqualTo(1);
        assertThat(existingAccount.getGroupName()).isEqualTo("原有分组");
    }

    @Test
    void deleteAccountsRequiresIdsAndDeletesOnlyOwnedAccounts() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        when(hotmailAccountMapper.delete(any())).thenReturn(2);
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("userAccessService", userAccessService);

        int deleted = service.deleteAccounts(3L, List.of(8L, 9L, 8L));

        assertThat(deleted).isEqualTo(2);
        verify(userAccessService).requireActiveUser(3L);
        verify(hotmailAccountMapper).delete(any());
    }

    @Test
    void deleteAccountsRejectsEmptySelection() throws Exception {
        setField("userAccessService", mock(UserAccessService.class));

        assertThatThrownBy(() -> service.deleteAccounts(3L, List.of()))
                .isInstanceOf(ApiException.class)
                .satisfies(throwable -> {
                    ApiException exception = (ApiException) throwable;
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });
    }

    @Test
    void publicCodeRateLimitRejectsRepeatedRequestsForTheSameKey() throws Exception {
        setField("publicCodeRateLimitPerMinute", 1L);

        invoke("requirePublicCodeRateLimit", "token:uid");

        assertThatThrownBy(() -> invoke("requirePublicCodeRateLimit", "token:uid"))
                .hasCauseInstanceOf(ApiException.class)
                .satisfies(throwable -> {
                    ApiException exception = (ApiException) throwable.getCause();
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                });
    }

    @Test
    void missingPublicCodeAccountDoesNotConsumePerTokenRateLimitWindow() throws Exception {
        setField("publicCodeRateLimitPerMinute", 1L);
        Supplier<HotmailAccount> missingLookup = () -> null;

        assertThatThrownBy(() -> invoke(
                "fetchLatestCodeByPublicAccount",
                new Class<?>[]{String.class, HotmailAccount.class, Supplier.class},
                "missing-token:missing-uid",
                null,
                missingLookup
        ))
                .hasCauseInstanceOf(ApiException.class)
                .satisfies(throwable -> {
                    ApiException exception = (ApiException) throwable.getCause();
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });

        assertThatThrownBy(() -> invoke(
                "fetchLatestCodeByPublicAccount",
                new Class<?>[]{String.class, HotmailAccount.class, Supplier.class},
                "missing-token:missing-uid",
                null,
                missingLookup
        ))
                .hasCauseInstanceOf(ApiException.class)
                .satisfies(throwable -> {
                    ApiException exception = (ApiException) throwable.getCause();
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });
    }

    @Test
    void extractCodeSupportsXaiHyphenatedEmailCode() throws Exception {
        String body = """
                xAI logo
                Validate your email

                Hi,

                Thank you for creating an xAI account. Please use the code below to validate your email address.
                BM8-VHA

                If you did not create a new account, please ignore this email.
                Sincerely,
                The xAI Team
                """;

        assertThat(invoke("extractCode", body)).isEqualTo("BM8-VHA");
    }

    @Test
    void extractCodePrefersXaiHyphenatedCodeOverFooterYear() throws Exception {
        String body = """
                xAI logo
                Validate your email

                Thank you for creating an xAI account. Please use the code below to validate your email address.
                BM8 – VHA

                © 2026 xAI
                """;

        assertThat(invoke("extractCode", body)).isEqualTo("BM8-VHA");
    }

    @Test
    void extractCodeSupportsXaiHtmlBodyWithFooterYear() throws Exception {
        String body = """
                <h1>Validate your email</h1>
                <p>Thank you for creating an xAI account. Please use the code below to validate your email address.</p>
                <table><tbody><tr><td style="text-align:center;font-size:26px;font-weight:bold">BM8-VHA</td></tr></tbody></table>
                <div style="color:#888888">© 2026 X.AI LLC</div>
                """;

        assertThat(invoke("extractCode", body)).isEqualTo("BM8-VHA");
    }

    @Test
    void extractCodeIgnoresFooterYearWhenNoCodeIsPresent() throws Exception {
        String body = """
                Validate your email
                Thank you for creating an xAI account. Please use the code below to validate your email address.
                © 2026 xAI
                """;

        assertThat(invoke("extractCode", body)).isNull();
    }

    @Test
    void disablePublicCodeLinkClearsPublicFieldsWithExplicitNullUpdate() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        UserAccessService userAccessService = mock(UserAccessService.class);
        HotmailAccount account = new HotmailAccount();
        account.setId(7L);
        account.setUserId(3L);
        account.setEmail("example@hotmail.com");
        account.setPublicCodeToken("00574647c0c6a9d1489c360253c0e35d");
        account.setPublicCodeUid("aa0661e4a22b61d20ec0");
        account.setPublicCodeTargetEmail("alias@hotmail.com");
        account.setPublicCodeEnabled(true);
        account.setPublicCodeCreatedAt(new Date());
        account.setPublicCodeLastAccessTime(new Date());

        when(hotmailAccountMapper.selectById(7L)).thenReturn(account);
        when(hotmailAccountMapper.update(eq(null), any(UpdateWrapper.class))).thenReturn(1);
        setField("hotmailAccountMapper", hotmailAccountMapper);
        setField("userAccessService", userAccessService);

        HotmailAccountDto dto = service.disablePublicCodeLink(3L, 7L);

        assertThat(dto.getPublicCodeToken()).isNull();
        assertThat(dto.getPublicCodeUid()).isNull();
        assertThat(dto.getPublicCodeTargetEmail()).isNull();
        assertThat(dto.isPublicCodeEnabled()).isFalse();
        assertThat(dto.getPublicCodeCreatedAt()).isNull();
        assertThat(dto.getPublicCodeLastAccessTime()).isNull();
        verify(userAccessService).requireActiveUser(3L);
        verify(hotmailAccountMapper).update(eq(null), any(UpdateWrapper.class));
        verify(hotmailAccountMapper, never()).updateById(any(HotmailAccount.class));
    }

    @Test
    void ensurePublicCodeUidBackfillUsesNarrowUpdate() throws Exception {
        HotmailAccountMapper hotmailAccountMapper = mock(HotmailAccountMapper.class);
        HotmailAccount account = new HotmailAccount();
        account.setId(8L);
        account.setUserId(3L);
        account.setEmail("legacy@hotmail.com");
        account.setPublicCodeToken("legacy_token-123");
        account.setPublicCodeEnabled(true);

        when(hotmailAccountMapper.selectCount(any())).thenReturn(0L);
        when(hotmailAccountMapper.update(eq(null), any(UpdateWrapper.class))).thenReturn(1);
        setField("hotmailAccountMapper", hotmailAccountMapper);

        HotmailAccount updatedAccount = (HotmailAccount) invoke(
                "ensurePublicCodeUid",
                new Class<?>[]{HotmailAccount.class},
                account
        );

        assertThat(updatedAccount.getPublicCodeUid()).matches("^[0-9a-f]{20}$");
        verify(hotmailAccountMapper).update(eq(null), any(UpdateWrapper.class));
        verify(hotmailAccountMapper, never()).updateById(any(HotmailAccount.class));
    }

    private Object parse(String line) throws Exception {
        Method method = HotmailCodeService.class.getDeclaredMethod("parseImportLine", String.class);
        method.setAccessible(true);
        return method.invoke(service, line);
    }

    private Object value(Object target, String methodName) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName);
        method.setAccessible(true);
        return method.invoke(target);
    }

    private Object invoke(String methodName) throws Exception {
        Method method = HotmailCodeService.class.getDeclaredMethod(methodName);
        method.setAccessible(true);
        return method.invoke(service);
    }

    private Object invoke(String methodName, String value) throws Exception {
        Method method = HotmailCodeService.class.getDeclaredMethod(methodName, String.class);
        method.setAccessible(true);
        return method.invoke(service, value);
    }

    private Object invoke(String methodName, Class<?>[] parameterTypes, Object... values) throws Exception {
        Method method = HotmailCodeService.class.getDeclaredMethod(methodName, parameterTypes);
        method.setAccessible(true);
        return method.invoke(service, values);
    }

    private void setField(String fieldName, Object value) throws Exception {
        Field field = HotmailCodeService.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(service, value);
    }
}
