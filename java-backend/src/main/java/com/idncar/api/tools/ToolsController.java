package com.idncar.api.tools;

import com.idncar.model.dto.BatchUpdateHotmailAccountGroupRequest;
import com.idncar.model.dto.BatchUpdateHotmailAccountRegistrationRequest;
import com.idncar.model.dto.BatchDeleteHotmailAccountsRequest;
import com.idncar.model.dto.FetchHotmailCodesRequest;
import com.idncar.model.dto.HotmailAccountDto;
import com.idncar.model.dto.HotmailCodeResult;
import com.idncar.model.dto.GenerateHotmailPublicLinkRequest;
import com.idncar.model.dto.HotmailPasswordResponse;
import com.idncar.model.dto.ImportHotmailAccountsRequest;
import com.idncar.model.dto.ImportHotmailAccountsResponse;
import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;
import com.idncar.model.dto.ToolDiagnosticsResponse;
import com.idncar.model.dto.UpdateHotmailAccountMetadataRequest;
import com.idncar.service.HotmailCodeService;
import com.idncar.service.JavaDecompileService;
import com.idncar.service.UserAccessService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tools")
public class ToolsController {

    @Autowired
    private JavaDecompileService javaDecompileService;

    @Autowired
    private HotmailCodeService hotmailCodeService;

    @Autowired
    private UserAccessService userAccessService;

    @GetMapping("/diagnostics")
    public ResponseEntity<ToolDiagnosticsResponse> diagnostics(
            @RequestAttribute("userId") Long userId,
            HttpServletRequest request
    ) {
        userAccessService.requireActiveUser(userId);
        Instant now = Instant.now();
        ToolDiagnosticsResponse result = new ToolDiagnosticsResponse();
        result.setRequestId(UUID.randomUUID().toString());
        result.setUserId(userId);
        result.setServerTimeMillis(now.toEpochMilli());
        result.setServerTimeIso(now.toString());
        result.setServerZone(ZoneId.systemDefault().toString());
        result.setJavaVersion(System.getProperty("java.version"));
        result.setRemoteAddr(request.getRemoteAddr());
        result.setForwardedFor(request.getHeader("X-Forwarded-For"));
        result.setMethod(request.getMethod());
        result.setPath(request.getRequestURI());
        result.setUserAgent(request.getHeader(HttpHeaders.USER_AGENT));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(result);
    }

    @PostMapping("/java-decompile")
    public ResponseEntity<JavaDecompileResponse> javaDecompile(
            @RequestAttribute("userId") Long userId,
            @RequestBody JavaDecompileRequest request
    ) {
        userAccessService.requireActiveUser(userId);
        return ResponseEntity.ok(javaDecompileService.decompile(request));
    }

    @GetMapping("/hotmail/accounts")
    public ResponseEntity<List<HotmailAccountDto>> getHotmailAccounts(
            @RequestAttribute("userId") Long userId
    ) {
        return ResponseEntity.ok(hotmailCodeService.getAccounts(userId));
    }

    @PostMapping("/hotmail/accounts/{accountId}/metadata")
    public ResponseEntity<HotmailAccountDto> updateHotmailAccountMetadata(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId,
            @RequestBody UpdateHotmailAccountMetadataRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.updateAccountMetadata(userId, accountId, request));
    }

    @PostMapping("/hotmail/accounts/group")
    public ResponseEntity<List<HotmailAccountDto>> updateHotmailAccountGroup(
            @RequestAttribute("userId") Long userId,
            @RequestBody BatchUpdateHotmailAccountGroupRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.updateAccountGroup(userId, request));
    }

    @PostMapping("/hotmail/accounts/registration")
    public ResponseEntity<List<HotmailAccountDto>> updateHotmailAccountRegistration(
            @RequestAttribute("userId") Long userId,
            @RequestBody BatchUpdateHotmailAccountRegistrationRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.updateAccountRegistration(userId, request));
    }

    @PostMapping("/hotmail/import")
    public ResponseEntity<ImportHotmailAccountsResponse> importHotmailAccounts(
            @RequestAttribute("userId") Long userId,
            @RequestBody ImportHotmailAccountsRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.importAccounts(userId, request.getContent(), request.getGroupName()));
    }

    @DeleteMapping("/hotmail/accounts/{accountId}")
    public ResponseEntity<Map<String, String>> deleteHotmailAccount(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId
    ) {
        hotmailCodeService.deleteAccount(userId, accountId);
        Map<String, String> result = new HashMap<>();
        result.put("message", "删除成功");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/hotmail/accounts/batch-delete")
    public ResponseEntity<Map<String, Object>> deleteHotmailAccounts(
            @RequestAttribute("userId") Long userId,
            @RequestBody BatchDeleteHotmailAccountsRequest request
    ) {
        int deleted = hotmailCodeService.deleteAccounts(userId, request == null ? null : request.getAccountIds());
        Map<String, Object> result = new HashMap<>();
        result.put("message", "删除成功");
        result.put("deleted", deleted);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/hotmail/accounts/{accountId}/password/reveal")
    public ResponseEntity<HotmailPasswordResponse> getHotmailAccountPassword(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId
    ) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(hotmailCodeService.getAccountPassword(userId, accountId));
    }

    @PostMapping("/hotmail/accounts/{accountId}/public-link")
    public ResponseEntity<HotmailAccountDto> generateHotmailPublicLink(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId,
            @RequestBody(required = false) GenerateHotmailPublicLinkRequest request
    ) {
        String targetEmail = request == null ? null : request.getTargetEmail();
        return ResponseEntity.ok(hotmailCodeService.generatePublicCodeLink(userId, accountId, targetEmail));
    }

    @DeleteMapping("/hotmail/accounts/{accountId}/public-link")
    public ResponseEntity<HotmailAccountDto> disableHotmailPublicLink(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId
    ) {
        return ResponseEntity.ok(hotmailCodeService.disablePublicCodeLink(userId, accountId));
    }

    @PostMapping("/hotmail/fetch/{accountId}")
    public ResponseEntity<HotmailCodeResult> fetchHotmailCode(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId
    ) {
        return ResponseEntity.ok(hotmailCodeService.fetchLatestCode(userId, accountId));
    }

    @PostMapping("/hotmail/fetch-all")
    public ResponseEntity<List<HotmailCodeResult>> fetchAllHotmailCodes(
            @RequestAttribute("userId") Long userId
    ) {
        return ResponseEntity.ok(hotmailCodeService.fetchAllLatestCodes(userId));
    }

    @PostMapping("/hotmail/fetch-batch")
    public ResponseEntity<List<HotmailCodeResult>> fetchHotmailCodes(
            @RequestAttribute("userId") Long userId,
            @RequestBody FetchHotmailCodesRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.fetchLatestCodes(userId, request == null ? null : request.getAccountIds()));
    }

    @PostMapping("/hotmail/check/{accountId}")
    public ResponseEntity<HotmailAccountDto> checkHotmailAccount(
            @RequestAttribute("userId") Long userId,
            @PathVariable Long accountId
    ) {
        return ResponseEntity.ok(hotmailCodeService.checkAccount(userId, accountId));
    }

    @PostMapping("/hotmail/check")
    public ResponseEntity<List<HotmailAccountDto>> checkHotmailAccounts(
            @RequestAttribute("userId") Long userId,
            @RequestBody(required = false) FetchHotmailCodesRequest request
    ) {
        return ResponseEntity.ok(hotmailCodeService.checkAccounts(userId, request == null ? null : request.getAccountIds()));
    }
}
