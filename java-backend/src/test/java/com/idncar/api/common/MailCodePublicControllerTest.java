package com.idncar.api.common;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.PublicMailCodeFetchResponse;
import com.idncar.model.dto.PublicMailCodeResult;
import com.idncar.service.HotmailCodeService;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.core.config.Configurator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MailCodePublicControllerTest {

    private static final String FETCH_TOKEN = "00574647c0c6a9d1489c360253c0e35d";
    private static final String FETCH_UID = "aa0661e4a22b61d20ec0";

    private final HotmailCodeService hotmailCodeService = mock(HotmailCodeService.class);
    private final MailCodePublicController controller = new MailCodePublicController(hotmailCodeService);
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

    @BeforeAll
    static void silenceControllerErrorLogs() {
        Configurator.setLevel(MailCodePublicController.class.getName(), Level.OFF);
    }

    @AfterAll
    static void restoreControllerErrorLogs() {
        Configurator.setLevel(MailCodePublicController.class.getName(), Level.ERROR);
    }

    @Test
    void legacyGetCodeUsesTokenOnlyLookupAndSameEnvelopeShape() {
        PublicMailCodeResult result = new PublicMailCodeResult();
        result.setFound(true);
        result.setCode("654321");
        result.setEmail("legacy@hotmail.com");
        when(hotmailCodeService.fetchLatestCodeByPublicToken("legacy_token-123"))
                .thenReturn(result);

        ResponseEntity<PublicMailCodeFetchResponse> response = controller.getCode("legacy_token-123");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(PublicMailCodeFetchResponse.CODE_OK);
        assertThat(response.getBody().getData().getCode()).isEqualTo("654321");
        verify(hotmailCodeService).fetchLatestCodeByPublicToken("legacy_token-123");
        verify(hotmailCodeService, never()).fetchLatestCodeByPublicTokenAndUid("legacy_token-123", null);
    }

    @Test
    void fetchCodeReturnsWaitingEnvelopeWhenCodeIsNotFound() {
        PublicMailCodeResult result = new PublicMailCodeResult();
        result.setFound(false);
        when(hotmailCodeService.fetchLatestCodeByPublicTokenAndUid(FETCH_TOKEN, FETCH_UID))
                .thenReturn(result);

        ResponseEntity<PublicMailCodeFetchResponse> response = controller.fetchCode(FETCH_TOKEN, FETCH_UID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(PublicMailCodeFetchResponse.CODE_WAITING);
        assertThat(response.getBody().getMessage()).isEqualTo(PublicMailCodeFetchResponse.MESSAGE_WAITING);
        assertThat(response.getBody().getData()).isNull();
    }

    @Test
    void fetchCodeRouteAcceptsTrailingSlashAndKeepsNoStoreEnvelope() throws Exception {
        PublicMailCodeResult result = new PublicMailCodeResult();
        result.setFound(false);
        when(hotmailCodeService.fetchLatestCodeByPublicTokenAndUid(FETCH_TOKEN, FETCH_UID))
                .thenReturn(result);

        mockMvc.perform(get("/api/code/fetch/")
                        .param("token", FETCH_TOKEN)
                        .param("uid", FETCH_UID))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
                .andExpect(header().dateValue(HttpHeaders.EXPIRES, 0))
                .andExpect(jsonPath("$.code").value(PublicMailCodeFetchResponse.CODE_WAITING))
                .andExpect(jsonPath("$.message").value(PublicMailCodeFetchResponse.MESSAGE_WAITING))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void fetchCodeRouteKeepsEnvelopeWhenUidIsMissing() throws Exception {
        mockMvc.perform(get("/api/code/fetch")
                        .param("token", FETCH_TOKEN))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string(HttpHeaders.PRAGMA, "no-cache"))
                .andExpect(header().dateValue(HttpHeaders.EXPIRES, 0))
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("Missing token or uid"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void fetchCodeReturnsSuccessEnvelopeWhenCodeIsFound() {
        PublicMailCodeResult result = new PublicMailCodeResult();
        result.setFound(true);
        result.setCode(" 123456 ");
        result.setEmail("example@hotmail.com");
        result.setSource("IMAP");
        result.setError("internal detail");
        when(hotmailCodeService.fetchLatestCodeByPublicTokenAndUid(FETCH_TOKEN, FETCH_UID))
                .thenReturn(result);

        ResponseEntity<PublicMailCodeFetchResponse> response = controller.fetchCode(FETCH_TOKEN, FETCH_UID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(PublicMailCodeFetchResponse.CODE_OK);
        assertThat(response.getBody().getMessage()).isEqualTo(PublicMailCodeFetchResponse.MESSAGE_OK);
        assertThat(response.getBody().getData().getCode()).isEqualTo("123456");
        assertThat(response.getBody().getData().getEmail()).isEqualTo("example@hotmail.com");
        assertThat(response.getBody().getData())
                .hasOnlyFields("email", "code", "receivedTime", "fetchTime");
    }

    @Test
    void fetchCodeReturnsWaitingWhenFoundFlagHasNoCode() {
        PublicMailCodeResult result = new PublicMailCodeResult();
        result.setFound(true);
        result.setCode(" ");
        result.setEmail("example@hotmail.com");
        when(hotmailCodeService.fetchLatestCodeByPublicTokenAndUid(FETCH_TOKEN, FETCH_UID))
                .thenReturn(result);

        ResponseEntity<PublicMailCodeFetchResponse> response = controller.fetchCode(FETCH_TOKEN, FETCH_UID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(PublicMailCodeFetchResponse.CODE_WAITING);
        assertThat(response.getBody().getMessage()).isEqualTo(PublicMailCodeFetchResponse.MESSAGE_WAITING);
        assertThat(response.getBody().getData()).isNull();
    }

    @Test
    void publicApiErrorsUseTheSameEnvelopeShape() {
        ResponseEntity<PublicMailCodeFetchResponse> response = controller.handleApiException(ApiException.notFound("Mail code link not found"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(404);
        assertThat(response.getBody().getMessage()).isEqualTo("Mail code link not found");
        assertThat(response.getBody().getData()).isNull();
    }

    @Test
    void missingTokenOrUidUsesTheSameEnvelopeShape() {
        ResponseEntity<PublicMailCodeFetchResponse> response = controller.handleMissingServletRequestParameter();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(400);
        assertThat(response.getBody().getMessage()).isEqualTo("Missing token or uid");
        assertThat(response.getBody().getData()).isNull();
    }

    @Test
    void unexpectedErrorsUseTheSameEnvelopeShape() {
        ResponseEntity<PublicMailCodeFetchResponse> response = controller.handleException(new RuntimeException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertNoStoreHeaders(response);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(500);
        assertThat(response.getBody().getMessage()).isEqualTo("Internal server error");
        assertThat(response.getBody().getData()).isNull();
    }

    private void assertNoStoreHeaders(ResponseEntity<PublicMailCodeFetchResponse> response) {
        assertThat(response.getHeaders().getCacheControl()).contains("no-store");
        assertThat(response.getHeaders().getPragma()).isEqualTo("no-cache");
        assertThat(response.getHeaders().getExpires()).isEqualTo(0);
    }
}
