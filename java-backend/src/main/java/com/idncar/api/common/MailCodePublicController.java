package com.idncar.api.common;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.PublicMailCodeFetchResponse;
import com.idncar.model.dto.PublicMailCodeResult;
import com.idncar.service.HotmailCodeService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Slf4j
public class MailCodePublicController {

    private final HotmailCodeService hotmailCodeService;

    public MailCodePublicController(HotmailCodeService hotmailCodeService) {
        this.hotmailCodeService = hotmailCodeService;
    }

    @GetMapping("/api/mail/get/{token}")
    public ResponseEntity<PublicMailCodeFetchResponse> getCode(@PathVariable String token) {
        return noStore(hotmailCodeService.fetchLatestCodeByPublicToken(token));
    }

    @GetMapping({"/api/code/fetch", "/api/code/fetch/"})
    public ResponseEntity<PublicMailCodeFetchResponse> fetchCode(
            @RequestParam String token,
            @RequestParam String uid
    ) {
        return noStore(hotmailCodeService.fetchLatestCodeByPublicTokenAndUid(token, uid));
    }

    private ResponseEntity<PublicMailCodeFetchResponse> noStore(PublicMailCodeResult result) {
        if (hasVerificationCode(result)) {
            return noStoreResponse(PublicMailCodeFetchResponse.ok(result));
        }
        // 没有验证码，但提取到验证链接/正文时，仍返回等待码，但携带上下文供页面展示。
        if (hasFallbackContext(result)) {
            return noStoreResponse(PublicMailCodeFetchResponse.waiting(result));
        }
        return noStoreResponse(PublicMailCodeFetchResponse.waiting());
    }

    private boolean hasVerificationCode(PublicMailCodeResult result) {
        return result != null && result.isFound() && result.getCode() != null && !result.getCode().isBlank();
    }

    private boolean hasFallbackContext(PublicMailCodeResult result) {
        if (result == null) {
            return false;
        }
        boolean hasLink = result.getLink() != null && !result.getLink().isBlank();
        boolean hasBody = result.getBodyPreview() != null && !result.getBodyPreview().isBlank();
        return hasLink || hasBody;
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<PublicMailCodeFetchResponse> handleApiException(ApiException exception) {
        return noStoreError(exception.getStatus().value(), exception.getMessage());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<PublicMailCodeFetchResponse> handleMissingServletRequestParameter() {
        return noStoreError(400, "Missing token or uid");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<PublicMailCodeFetchResponse> handleException(Exception exception) {
        log.error("Public mail code fetch failed", exception);
        return noStoreError(500, "Internal server error");
    }

    private ResponseEntity<PublicMailCodeFetchResponse> noStoreError(int code, String message) {
        return noStoreResponse(PublicMailCodeFetchResponse.error(code, message));
    }

    private ResponseEntity<PublicMailCodeFetchResponse> noStoreResponse(PublicMailCodeFetchResponse response) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .headers(headers -> headers.setExpires(0))
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(response);
    }
}
