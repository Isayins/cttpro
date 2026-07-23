package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.HotmailAccountMapper;
import com.idncar.model.dto.BatchUpdateHotmailAccountGroupRequest;
import com.idncar.model.dto.BatchUpdateHotmailAccountRegistrationRequest;
import com.idncar.model.dto.HotmailAccountDto;
import com.idncar.model.dto.HotmailCodeResult;
import com.idncar.model.dto.HotmailImportFailure;
import com.idncar.model.dto.HotmailPasswordResponse;
import com.idncar.model.dto.ImportHotmailAccountsResponse;
import com.idncar.model.dto.PublicMailCodeResult;
import com.idncar.model.dto.UpdateHotmailAccountMetadataRequest;
import com.idncar.model.entity.HotmailAccount;
import com.idncar.util.HotmailCredentialCrypto;
import jakarta.mail.Address;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class HotmailCodeService {

    private static final String TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private static final String GRAPH_MESSAGES_URL = "https://graph.microsoft.com/v1.0/me/messages";
    private static final String GRAPH_MAIL_FOLDERS_URL = "https://graph.microsoft.com/v1.0/me/mailFolders";
    private static final String OUTLOOK_REST_MESSAGES_URL = "https://outlook.office.com/api/v2.0/me/messages";
    private static final String OUTLOOK_REST_MAIL_FOLDERS_URL = "https://outlook.office.com/api/v2.0/me/mailfolders";
    private static final String OUTLOOK_IMAP_HOST = "outlook.office365.com";
    private static final String GRAPH_SCOPE = "offline_access https://graph.microsoft.com/Mail.Read";
    private static final String OUTLOOK_REST_SCOPE = "offline_access https://outlook.office.com/Mail.Read";
    private static final String OUTLOOK_IMAP_SCOPE = "offline_access https://outlook.office.com/IMAP.AccessAsUser.All";
    private static final String TOKEN_CHECK_UNKNOWN = "UNKNOWN";
    private static final String TOKEN_CHECK_OK = "OK";
    private static final String TOKEN_CHECK_MISSING_IMAP = "MISSING_IMAP";
    private static final String TOKEN_CHECK_TOKEN_INVALID = "TOKEN_INVALID";
    private static final String TOKEN_CHECK_CREDENTIAL_DECRYPT_FAILED = "CREDENTIAL_DECRYPT_FAILED";
    private static final String TOKEN_CHECK_SERVICE_ABUSE_MODE = "SERVICE_ABUSE_MODE";
    private static final String TOKEN_CHECK_PARTIAL_FAIL = "PARTIAL_FAIL";
    private static final int GRAPH_FETCH_SIZE = 50;
    private static final int FOLDER_FETCH_SIZE = 20;
    private static final int MAX_FOLDER_FETCHES = 12;
    private static final int IMAP_FETCH_SIZE = 20;
    private static final int MAX_IMAP_FOLDERS = 12;
    private static final int MAX_PARALLEL_FETCHES = 6;
    private static final int FULL_BODY_CANDIDATE_LIMIT = 8;
    private static final int IMAP_BODY_FALLBACK_LIMIT = 6;
    private static final int MESSAGE_QUERY_CLOCK_SKEW_MINUTES = 2;
    private static final int HTTP_CONNECT_TIMEOUT_MS = 12_000;
    private static final int HTTP_READ_TIMEOUT_MS = 20_000;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CONTEXTUAL_CODE_PATTERN = Pattern.compile("(?i)(?:\\u9a8c\\u8bc1\\u7801|code|verification|verify|security code|one[- ]time|otp|pin|\\u786e\\u8ba4\\u7801|\\u6821\\u9a8c\\u7801)\\D{0,24}\\b((?=[A-Z0-9]*\\d)[A-Z0-9]{4,8})\\b");
    private static final Pattern SPACED_NUMERIC_CODE_PATTERN = Pattern.compile("(?<!\\d)(\\d(?:\\s+\\d){3,7})(?!\\d)");
    private static final Pattern STRICT_NUMERIC_CODE_PATTERN = Pattern.compile("\\b(\\d{6})\\b");
    private static final Pattern GENERAL_NUMERIC_CODE_PATTERN = Pattern.compile("\\b(\\d{4,8})\\b");
    private static final Pattern HYPHENATED_ALPHANUMERIC_CODE_PATTERN = Pattern.compile("\\b((?=[A-Z0-9\\s\\-\\u2013\\u2014]*\\d)[A-Z0-9]{2,4}\\s*[-\\u2013\\u2014]\\s*[A-Z0-9]{2,4})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERAL_ALPHANUMERIC_CODE_PATTERN = Pattern.compile("\\b([A-Z0-9]{6,8})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PUBLIC_CODE_TOKEN_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{16,80}$");
    private static final Pattern PUBLIC_CODE_UID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{8,80}$");
    private static final Pattern PUBLIC_CODE_FETCH_TOKEN_PATTERN = Pattern.compile("^[0-9a-f]{32}$");
    private static final Pattern PUBLIC_CODE_FETCH_UID_PATTERN = Pattern.compile("^[0-9a-f]{20}$");
    private static final Pattern IMPORT_STATUS_PATTERN = Pattern.compile("^\\d+$");
    private static final int PUBLIC_CODE_TOKEN_BYTES = 16;
    private static final int PUBLIC_CODE_UID_BYTES = 10;
    private static final int PUBLIC_CODE_TOKEN_GENERATE_RETRIES = 8;
    private static final int PUBLIC_CODE_UID_GENERATE_RETRIES = 8;
    private static final int PUBLIC_CODE_FETCH_LOCK_STRIPES = 128;
    private static final int PUBLIC_CODE_RATE_LIMITER_MAX_KEYS = 4096;
    private static final long PUBLIC_CODE_RATE_LIMIT_WINDOW_MILLIS = 60_000L;
    private static final long PUBLIC_CODE_RATE_LIMIT_IDLE_MILLIS = 120_000L;
    private static final char[] HEX_CHARS = "0123456789abcdef".toCharArray();

    @Autowired
    private HotmailAccountMapper hotmailAccountMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private HotmailCredentialCrypto hotmailCredentialCrypto;

    @Value("${app.hotmail.code-recent-minutes:30}")
    private long codeRecentMinutes;

    @Value("${app.hotmail.public-code-fetch-cooldown-seconds:20}")
    private long publicCodeFetchCooldownSeconds;

    @Value("${app.hotmail.public-code-access-touch-interval-seconds:60}")
    private long publicCodeAccessTouchIntervalSeconds;

    @Value("${app.hotmail.public-code-rate-limit-per-minute:60}")
    private long publicCodeRateLimitPerMinute;

    private final RestTemplate restTemplate = buildRestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();
    private final Object[] publicCodeFetchLocks = buildPublicCodeFetchLocks();
    private final ConcurrentMap<String, PublicCodeRateLimitWindow> publicCodeRateLimitWindows = new ConcurrentHashMap<>();

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(HTTP_READ_TIMEOUT_MS);
        return new RestTemplate(requestFactory);
    }

    public List<HotmailAccountDto> getAccounts(Long userId) {
        userAccessService.requireActiveUser(userId);
        List<HotmailAccount> accounts = hotmailAccountMapper.selectList(
                new LambdaQueryWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getUserId, userId)
                        .orderByAsc(HotmailAccount::getGroupName)
                        .orderByDesc(HotmailAccount::getUpdateTime)
                        .orderByDesc(HotmailAccount::getCreateTime)
        );
        return accounts.stream().map(this::ensurePublicCodeUid).map(this::toDto).toList();
    }

    public ImportHotmailAccountsResponse importAccounts(Long userId, String content) {
        return importAccounts(userId, content, null);
    }

    public ImportHotmailAccountsResponse importAccounts(Long userId, String content, String groupName) {
        userAccessService.requireActiveUser(userId);
        if (content == null || content.isBlank()) {
            throw ApiException.badRequest("Import content cannot be empty");
        }

        String normalizedGroupName = normalizeGroupName(groupName);
        String[] lines = content.split("\\r?\\n");
        ImportHotmailAccountsResponse response = new ImportHotmailAccountsResponse();
        int processedCount = 0;
        int skippedCount = 0;
        int batchDuplicateCount = 0;
        int existingDuplicateCount = 0;
        Set<String> seenEmails = new HashSet<>();

        for (int index = 0; index < lines.length; index++) {
            String line = lines[index];
            int lineNumber = index + 1;
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }

            ParsedHotmailAccount parsed = parseImportLine(trimmed);
            if (parsed.error() != null) {
                skippedCount++;
                response.getFailures().add(new HotmailImportFailure(lineNumber, parsed.email(), parsed.error()));
                continue;
            }

            String email = parsed.email();
            String password = parsed.password();
            String clientId = parsed.clientId();
            String refreshToken = parsed.refreshToken();
            if (!isValidEmail(email)) {
                skippedCount++;
                response.getFailures().add(new HotmailImportFailure(lineNumber, email, "邮箱格式不正确"));
                continue;
            }
            if (clientId == null || clientId.isBlank()) {
                skippedCount++;
                response.getFailures().add(new HotmailImportFailure(lineNumber, email, "缺少 client_id"));
                continue;
            }
            if (refreshToken == null || refreshToken.isBlank()) {
                skippedCount++;
                response.getFailures().add(new HotmailImportFailure(lineNumber, email, "缺少 refresh_token"));
                continue;
            }

            boolean duplicateInBatch = !seenEmails.add(email);
            if (duplicateInBatch) {
                batchDuplicateCount++;
            }

            HotmailAccount existingAccount = hotmailAccountMapper.selectOne(
                    new LambdaQueryWrapper<HotmailAccount>()
                            .eq(HotmailAccount::getUserId, userId)
                            .eq(HotmailAccount::getEmail, email)
                            .last("LIMIT 1")
            );

            if (existingAccount != null) {
                if (!duplicateInBatch) {
                    existingDuplicateCount++;
                }
                existingAccount.setClientId(clientId);
                if (password != null) {
                    existingAccount.setPassword(hotmailCredentialCrypto.encrypt(password));
                }
                if (normalizedGroupName != null && normalizeGroupName(existingAccount.getGroupName()) == null) {
                    existingAccount.setGroupName(normalizedGroupName);
                }
                existingAccount.setRefreshToken(hotmailCredentialCrypto.encrypt(refreshToken));
                existingAccount.setAccessToken(null);
                existingAccount.setTokenExpiresAt(null);
                existingAccount.setOutlookAccessToken(null);
                existingAccount.setOutlookTokenExpiresAt(null);
                existingAccount.setImapAccessToken(null);
                existingAccount.setImapTokenExpiresAt(null);
                resetTokenCheck(existingAccount);
                existingAccount.setUpdateTime(new Date());
                hotmailAccountMapper.updateById(existingAccount);
                processedCount++;
                continue;
            }

            HotmailAccount account = new HotmailAccount();
            account.setUserId(userId);
            account.setEmail(email);
            account.setGroupName(normalizedGroupName);
            account.setPassword(password == null ? null : hotmailCredentialCrypto.encrypt(password));
            account.setClientId(clientId);
            account.setRefreshToken(hotmailCredentialCrypto.encrypt(refreshToken));
            account.setTokenCheckStatus(TOKEN_CHECK_UNKNOWN);
            account.setCreateTime(new Date());
            account.setUpdateTime(new Date());
            hotmailAccountMapper.insert(account);
            processedCount++;
        }

        response.setImported(processedCount);
        response.setSkipped(skippedCount);
        response.setBatchDuplicateCount(batchDuplicateCount);
        response.setExistingDuplicateCount(existingDuplicateCount);
        response.setDuplicateCount(batchDuplicateCount + existingDuplicateCount);
        response.setMessage(skippedCount > 0 ? "导入完成，部分行未处理" : "导入成功");
        return response;
    }

    public void deleteAccount(Long userId, Long accountId) {
        userAccessService.requireActiveUser(userId);
        HotmailAccount account = hotmailAccountMapper.selectById(accountId);
        if (account == null || !account.getUserId().equals(userId)) {
            throw ApiException.notFound("Mailbox account not found");
        }
        hotmailAccountMapper.deleteById(accountId);
    }

    public int deleteAccounts(Long userId, List<Long> accountIds) {
        userAccessService.requireActiveUser(userId);
        List<Long> requestedIds = normalizeAccountIds(accountIds);
        if (requestedIds.isEmpty()) {
            throw ApiException.badRequest("请选择要删除的邮箱");
        }

        return hotmailAccountMapper.delete(
                new LambdaQueryWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getUserId, userId)
                        .in(HotmailAccount::getId, requestedIds)
        );
    }

    public HotmailAccountDto updateAccountMetadata(Long userId, Long accountId, UpdateHotmailAccountMetadataRequest request) {
        userAccessService.requireActiveUser(userId);
        HotmailAccount account = hotmailAccountMapper.selectById(accountId);
        if (account == null || !account.getUserId().equals(userId)) {
            throw ApiException.notFound("Mailbox account not found");
        }

        if (request == null) {
            throw ApiException.badRequest("请求内容不能为空");
        }

        if (request.getGroupName() != null) {
            account.setGroupName(normalizeGroupName(request.getGroupName()));
        }
        String nextSubEmails = account.getSubEmails();
        if (request.getSubEmails() != null) {
            nextSubEmails = normalizeSubEmails(request.getSubEmails(), account.getEmail());
            account.setSubEmails(nextSubEmails);
        }
        if (request.getGptRegistered() != null) {
            account.setGptRegistered(request.getGptRegistered());
        }
        if (request.getGptRegisteredSubEmails() != null) {
            account.setGptRegisteredSubEmails(normalizeRegisteredSubEmails(request.getGptRegisteredSubEmails(), nextSubEmails));
        } else if (request.getSubEmails() != null) {
            account.setGptRegisteredSubEmails(normalizeRegisteredSubEmails(account.getGptRegisteredSubEmails(), nextSubEmails));
        }
        if (request.getGrokRegistered() != null) {
            account.setGrokRegistered(request.getGrokRegistered());
        }
        if (request.getGrokRegisteredSubEmails() != null) {
            account.setGrokRegisteredSubEmails(normalizeRegisteredSubEmails(request.getGrokRegisteredSubEmails(), nextSubEmails));
        } else if (request.getSubEmails() != null) {
            account.setGrokRegisteredSubEmails(normalizeRegisteredSubEmails(account.getGrokRegisteredSubEmails(), nextSubEmails));
        }

        account.setUpdateTime(new Date());
        hotmailAccountMapper.updateById(account);
        return toDto(account);
    }

    public List<HotmailAccountDto> updateAccountRegistration(Long userId, BatchUpdateHotmailAccountRegistrationRequest request) {
        userAccessService.requireActiveUser(userId);
        if (request == null || request.getAccountIds() == null || request.getAccountIds().isEmpty()) {
            throw ApiException.badRequest("请选择要标记的邮箱");
        }

        List<Long> accountIds = normalizeAccountIds(request.getAccountIds());
        if (accountIds.isEmpty()) {
            throw ApiException.badRequest("请选择要标记的邮箱");
        }
        if (request.getGptRegistered() == null && request.getGrokRegistered() == null) {
            throw ApiException.badRequest("请选择要更新的注册标记");
        }

        Date now = new Date();
        LambdaUpdateWrapper<HotmailAccount> updateWrapper = new LambdaUpdateWrapper<HotmailAccount>()
                .eq(HotmailAccount::getUserId, userId)
                .in(HotmailAccount::getId, accountIds)
                .set(HotmailAccount::getUpdateTime, now);
        if (request.getGptRegistered() != null) {
            updateWrapper.set(HotmailAccount::getGptRegistered, request.getGptRegistered());
        }
        if (request.getGrokRegistered() != null) {
            updateWrapper.set(HotmailAccount::getGrokRegistered, request.getGrokRegistered());
        }
        hotmailAccountMapper.update(null, updateWrapper);

        return getAccountsByIds(userId, accountIds).stream().map(this::ensurePublicCodeUid).map(this::toDto).toList();
    }

    public List<HotmailAccountDto> updateAccountGroup(Long userId, BatchUpdateHotmailAccountGroupRequest request) {
        userAccessService.requireActiveUser(userId);
        if (request == null || request.getAccountIds() == null || request.getAccountIds().isEmpty()) {
            throw ApiException.badRequest("请选择要分组的邮箱");
        }

        List<Long> accountIds = normalizeAccountIds(request.getAccountIds());
        if (accountIds.isEmpty()) {
            throw ApiException.badRequest("请选择要分组的邮箱");
        }

        String groupName = normalizeGroupName(request.getGroupName());
        Date now = new Date();
        hotmailAccountMapper.update(
                null,
                new LambdaUpdateWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getUserId, userId)
                        .in(HotmailAccount::getId, accountIds)
                        .set(HotmailAccount::getGroupName, groupName)
                        .set(HotmailAccount::getUpdateTime, now)
        );
        return getAccountsByIds(userId, accountIds).stream().map(this::ensurePublicCodeUid).map(this::toDto).toList();
    }

    public HotmailPasswordResponse getAccountPassword(Long userId, Long accountId) {
        userAccessService.requireActiveUser(userId);
        HotmailAccount account = hotmailAccountMapper.selectById(accountId);
        if (account == null || !account.getUserId().equals(userId)) {
            throw ApiException.notFound("Mailbox account not found");
        }

        String password = hotmailCredentialCrypto.decrypt(account.getPassword());
        if (password == null || password.isBlank()) {
            throw ApiException.notFound("当前邮箱没有保存密码，请重新用四段格式导入");
        }

        HotmailPasswordResponse response = new HotmailPasswordResponse();
        response.setAccountId(account.getId());
        response.setEmail(account.getEmail());
        response.setPassword(password);
        return response;
    }

    public HotmailAccountDto generatePublicCodeLink(Long userId, Long accountId, String targetEmail) {
        userAccessService.requireActiveUser(userId);
        synchronized (getPublicCodeFetchLock(accountId)) {
            HotmailAccount account = getOwnedAccount(userId, accountId);
            String normalizedTargetEmail = normalizePublicTargetEmail(account, targetEmail);
            String token = generateUniquePublicCodeToken();
            String uid = generateUniquePublicCodeUid();
            Date now = new Date();

            hotmailAccountMapper.update(
                    null,
                    new UpdateWrapper<HotmailAccount>()
                            .eq("id", account.getId())
                            .eq("user_id", userId)
                            .set("public_code_token", token)
                            .set("public_code_uid", uid)
                            .set("public_code_target_email", normalizedTargetEmail)
                            .set("public_code_enabled", true)
                            .set("public_code_created_at", now)
                            .set("public_code_last_access_time", null)
                            .set("update_time", now)
            );

            account.setPublicCodeToken(token);
            account.setPublicCodeUid(uid);
            account.setPublicCodeTargetEmail(normalizedTargetEmail);
            account.setPublicCodeEnabled(true);
            account.setPublicCodeCreatedAt(now);
            account.setPublicCodeLastAccessTime(null);
            account.setUpdateTime(now);
            return toDto(account);
        }
    }

    public HotmailAccountDto disablePublicCodeLink(Long userId, Long accountId) {
        userAccessService.requireActiveUser(userId);
        synchronized (getPublicCodeFetchLock(accountId)) {
            HotmailAccount account = getOwnedAccount(userId, accountId);
            Date now = new Date();

            hotmailAccountMapper.update(
                    null,
                    new UpdateWrapper<HotmailAccount>()
                            .eq("id", account.getId())
                            .eq("user_id", userId)
                            .set("public_code_token", null)
                            .set("public_code_uid", null)
                            .set("public_code_target_email", null)
                            .set("public_code_enabled", false)
                            .set("public_code_created_at", null)
                            .set("public_code_last_access_time", null)
                            .set("update_time", now)
            );

            account.setPublicCodeToken(null);
            account.setPublicCodeUid(null);
            account.setPublicCodeTargetEmail(null);
            account.setPublicCodeEnabled(false);
            account.setPublicCodeCreatedAt(null);
            account.setPublicCodeLastAccessTime(null);
            account.setUpdateTime(now);
            return toDto(account);
        }
    }

    public PublicMailCodeResult fetchLatestCodeByPublicToken(String token) {
        String normalizedToken = normalizePublicCodeToken(token);
        return fetchLatestCodeByPublicAccount(
                normalizedToken,
                findPublicCodeAccount(normalizedToken),
                () -> findPublicCodeAccount(normalizedToken)
        );
    }

    public PublicMailCodeResult fetchLatestCodeByPublicTokenAndUid(String token, String uid) {
        String normalizedToken = normalizePublicCodeFetchToken(token);
        String normalizedUid = normalizePublicCodeFetchUid(uid);
        String rateLimitKey = normalizedToken + ":" + normalizedUid;
        return fetchLatestCodeByPublicAccount(
                rateLimitKey,
                findPublicCodeAccount(normalizedToken, normalizedUid),
                () -> findPublicCodeAccount(normalizedToken, normalizedUid)
        );
    }

    private PublicMailCodeResult fetchLatestCodeByPublicAccount(
            String rateLimitKey,
            HotmailAccount account,
            Supplier<HotmailAccount> accountLookup
    ) {
        if (account == null) {
            throw ApiException.notFound("Mail code link not found");
        }

        requirePublicCodeRateLimit(rateLimitKey);
        synchronized (getPublicCodeFetchLock(account.getId())) {
            HotmailAccount lockedAccount = accountLookup.get();
            if (lockedAccount == null) {
                throw ApiException.notFound("Mail code link not found");
            }

            if (shouldUseCachedPublicResult(lockedAccount)) {
                touchPublicCodeAccess(lockedAccount, false);
                return toPublicMailCodeResult(lockedAccount, buildCachedPublicCodeResult(lockedAccount));
            }

            // Keep public links aligned with the admin "fetch and copy code" flow.
            HotmailCodeResult result = fetchLatestCodeForAccount(lockedAccount);
            touchPublicCodeAccess(lockedAccount, true);
            return toPublicMailCodeResult(lockedAccount, result);
        }
    }

    private String normalizePublicCodeToken(String token) {
        String normalizedToken = token == null ? "" : token.trim();
        if (!PUBLIC_CODE_TOKEN_PATTERN.matcher(normalizedToken).matches()
                || PUBLIC_CODE_FETCH_TOKEN_PATTERN.matcher(normalizedToken).matches()) {
            throw ApiException.notFound("Mail code link not found");
        }
        return normalizedToken;
    }

    private String normalizePublicCodeFetchToken(String token) {
        String normalizedToken = token == null ? "" : token.trim();
        if (!PUBLIC_CODE_FETCH_TOKEN_PATTERN.matcher(normalizedToken).matches()) {
            throw ApiException.notFound("Mail code link not found");
        }
        return normalizedToken;
    }

    private String normalizePublicCodeFetchUid(String uid) {
        String normalizedUid = uid == null ? "" : uid.trim();
        if (!PUBLIC_CODE_FETCH_UID_PATTERN.matcher(normalizedUid).matches()) {
            throw ApiException.notFound("Mail code link not found");
        }
        return normalizedUid;
    }

    public HotmailCodeResult fetchLatestCode(Long userId, Long accountId) {
        userAccessService.requireActiveUser(userId);
        HotmailAccount account = hotmailAccountMapper.selectById(accountId);
        if (account == null || !account.getUserId().equals(userId)) {
            throw ApiException.notFound("Mailbox account not found");
        }

        return fetchLatestCodeForAccount(account);
    }

    private HotmailCodeResult fetchLatestCodeForAccount(HotmailAccount account) {
        return fetchLatestCodeForAccount(account, null);
    }

    private HotmailCodeResult fetchLatestCodeForAccount(HotmailAccount account, String targetEmail) {
        String normalizedTargetEmail = normalizeEmail(targetEmail);

        TokenRefreshResult graphToken = null;
        TokenRefreshResult outlookToken = null;
        TokenRefreshResult imapToken = null;
        TokenRefreshResult latestToken = null;
        List<String> errors = new ArrayList<>();

        try {
            graphToken = refreshAccessToken(account, GRAPH_SCOPE, TokenCache.GRAPH);
            rememberRefreshToken(account, graphToken);
            latestToken = graphToken;
            HotmailCodeResult result = fetchCodeFromGraph(graphToken.accessToken(), account, normalizedTargetEmail);
            if (result.isFound()) {
                persistFetchResult(account, graphToken, outlookToken, imapToken, latestToken, result);
                return result;
            }
        } catch (Exception e) {
            log.warn("Graph mailbox code fetch failed: {}", account.getEmail(), e);
            errors.add("Graph: " + cleanErrorMessage(e));
        }

        try {
            outlookToken = refreshAccessToken(account, OUTLOOK_REST_SCOPE, TokenCache.OUTLOOK_REST);
            rememberRefreshToken(account, outlookToken);
            latestToken = outlookToken;
            HotmailCodeResult result = fetchCodeFromOutlookRest(outlookToken.accessToken(), account, normalizedTargetEmail);
            if (result.isFound()) {
                persistFetchResult(account, graphToken, outlookToken, imapToken, latestToken, result);
                return result;
            }
        } catch (Exception e) {
            log.warn("Outlook REST mailbox code fetch failed: {}", account.getEmail(), e);
            errors.add("Outlook REST: " + cleanErrorMessage(e));
        }

        try {
            imapToken = refreshAccessToken(account, OUTLOOK_IMAP_SCOPE, TokenCache.IMAP);
            rememberRefreshToken(account, imapToken);
            latestToken = imapToken;
            HotmailCodeResult result = fetchCodeFromImap(imapToken.accessToken(), account, normalizedTargetEmail);
            if (result.isFound()) {
                persistFetchResult(account, graphToken, outlookToken, imapToken, latestToken, result);
                return result;
            }
        } catch (Exception e) {
            log.warn("Outlook IMAP mailbox code fetch failed: {}", account.getEmail(), e);
            errors.add("IMAP: " + cleanErrorMessage(e));
        }

        HotmailCodeResult emptyResult = buildEmptyResult(account);
        emptyResult.setSource("none");
        emptyResult.setError(errors.isEmpty() ? "最近邮件中未找到验证码" : String.join("；", errors));
        persistFetchResult(account, graphToken, outlookToken, imapToken, latestToken, emptyResult);
        return emptyResult;
    }

    public List<HotmailCodeResult> fetchAllLatestCodes(Long userId) {
        return fetchLatestCodes(userId, null);
    }

    public List<HotmailCodeResult> fetchLatestCodes(Long userId, List<Long> accountIds) {
        userAccessService.requireActiveUser(userId);
        List<HotmailAccount> accounts = getAccountsForBatch(userId, accountIds);

        if (accounts.isEmpty()) {
            return List.of();
        }

        ExecutorService executor = Executors.newFixedThreadPool(Math.min(MAX_PARALLEL_FETCHES, accounts.size()));
        try {
            List<CompletableFuture<HotmailCodeResult>> futures = accounts.stream()
                    .map(account -> CompletableFuture.supplyAsync(() -> {
                        try {
                            return fetchLatestCodeForAccount(account);
                        } catch (Exception e) {
                            log.warn("Failed to fetch mailbox code in batch: {}", account.getEmail(), e);
                            return buildFailureResult(account, cleanErrorMessage(e));
                        }
                    }, executor))
                    .toList();

            return futures.stream().map(CompletableFuture::join).toList();
        } finally {
            executor.shutdown();
            try {
                executor.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    public HotmailAccountDto checkAccount(Long userId, Long accountId) {
        userAccessService.requireActiveUser(userId);
        return checkAccountTokenScopes(getOwnedAccount(userId, accountId));
    }

    public List<HotmailAccountDto> checkAccounts(Long userId, List<Long> accountIds) {
        userAccessService.requireActiveUser(userId);
        List<HotmailAccount> accounts = getAccountsForBatch(userId, accountIds);
        if (accounts.isEmpty()) {
            return List.of();
        }

        ExecutorService executor = Executors.newFixedThreadPool(Math.min(MAX_PARALLEL_FETCHES, accounts.size()));
        try {
            List<CompletableFuture<HotmailAccountDto>> futures = accounts.stream()
                    .map(account -> CompletableFuture.supplyAsync(() -> checkAccountTokenScopes(account), executor))
                    .toList();
            return futures.stream().map(CompletableFuture::join).toList();
        } finally {
            executor.shutdown();
            try {
                executor.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private HotmailAccountDto checkAccountTokenScopes(HotmailAccount account) {
        TokenRefreshResult graphToken = null;
        TokenRefreshResult outlookToken = null;
        TokenRefreshResult imapToken = null;
        TokenRefreshResult latestToken = null;
        List<String> errors = new ArrayList<>();
        boolean credentialDecryptFailed = false;
        boolean serviceAbuseMode = false;

        try {
            graphToken = refreshAccessToken(account, GRAPH_SCOPE, TokenCache.GRAPH, true);
            latestToken = graphToken;
            rememberRefreshToken(account, graphToken);
        } catch (Exception e) {
            credentialDecryptFailed |= isCredentialDecryptFailure(e);
            serviceAbuseMode |= isServiceAbuseModeFailure(e);
            errors.add("Graph: " + cleanErrorMessage(e));
        }

        try {
            outlookToken = refreshAccessToken(account, OUTLOOK_REST_SCOPE, TokenCache.OUTLOOK_REST, true);
            latestToken = outlookToken;
            rememberRefreshToken(account, outlookToken);
        } catch (Exception e) {
            credentialDecryptFailed |= isCredentialDecryptFailure(e);
            serviceAbuseMode |= isServiceAbuseModeFailure(e);
            errors.add("Outlook REST: " + cleanErrorMessage(e));
        }

        try {
            imapToken = refreshAccessToken(account, OUTLOOK_IMAP_SCOPE, TokenCache.IMAP, true);
            latestToken = imapToken;
            rememberRefreshToken(account, imapToken);
        } catch (Exception e) {
            credentialDecryptFailed |= isCredentialDecryptFailure(e);
            serviceAbuseMode |= isServiceAbuseModeFailure(e);
            errors.add("IMAP: " + cleanErrorMessage(e));
        }

        boolean graphOk = graphToken != null && graphToken.accessToken() != null && !graphToken.accessToken().isBlank();
        boolean outlookOk = outlookToken != null && outlookToken.accessToken() != null && !outlookToken.accessToken().isBlank();
        boolean imapOk = imapToken != null && imapToken.accessToken() != null && !imapToken.accessToken().isBlank();
        String status = resolveTokenCheckStatus(graphOk, outlookOk, imapOk, credentialDecryptFailed, serviceAbuseMode);
        String summary;
        if (TOKEN_CHECK_OK.equals(status)) {
            summary = "Graph、Outlook REST、IMAP 权限均可用";
        } else if (credentialDecryptFailed) {
            summary = "凭据解密失败，请确认 APP_HOTMAIL_ENCRYPTION_SECRET 与导入时一致后重新导入";
        } else if (serviceAbuseMode) {
            summary = "微软风控（service_abuse_mode），请停止重试或清除该邮箱";
        } else {
            summary = String.join("；", errors);
        }

        TokenRefreshResult refreshTokenSource = latestToken != null ? latestToken : graphToken;
        if (refreshTokenSource != null && refreshTokenSource.refreshToken() != null && !refreshTokenSource.refreshToken().isBlank()) {
            account.setRefreshToken(hotmailCredentialCrypto.encrypt(refreshTokenSource.refreshToken()));
        }
        if (graphToken != null) {
            setCachedToken(account, TokenCache.GRAPH, graphToken);
        }
        if (outlookToken != null) {
            setCachedToken(account, TokenCache.OUTLOOK_REST, outlookToken);
        }
        if (imapToken != null) {
            setCachedToken(account, TokenCache.IMAP, imapToken);
        }

        account.setGraphTokenOk(graphOk);
        account.setOutlookTokenOk(outlookOk);
        account.setImapTokenOk(imapOk);
        account.setTokenCheckStatus(status);
        account.setTokenCheckSummary(truncate(summary, 600));
        account.setTokenCheckedAt(new Date());
        account.setUpdateTime(new Date());
        hotmailAccountMapper.updateById(account);
        return toDto(account);
    }

    private String resolveTokenCheckStatus(
            boolean graphOk,
            boolean outlookOk,
            boolean imapOk,
            boolean credentialDecryptFailed,
            boolean serviceAbuseMode
    ) {
        if (credentialDecryptFailed) {
            return TOKEN_CHECK_CREDENTIAL_DECRYPT_FAILED;
        }
        if (serviceAbuseMode) {
            return TOKEN_CHECK_SERVICE_ABUSE_MODE;
        }
        if (graphOk && outlookOk && imapOk) {
            return TOKEN_CHECK_OK;
        }
        if (!graphOk && !outlookOk && !imapOk) {
            return TOKEN_CHECK_TOKEN_INVALID;
        }
        if ((graphOk || outlookOk) && !imapOk) {
            return TOKEN_CHECK_MISSING_IMAP;
        }
        return TOKEN_CHECK_PARTIAL_FAIL;
    }

    private boolean isCredentialDecryptFailure(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof IllegalStateException
                    && "Failed to decrypt Hotmail credential".equals(current.getMessage())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean isServiceAbuseModeFailure(Throwable error) {
        Throwable current = error;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains("service_abuse_mode")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private TokenRefreshResult refreshAccessToken(HotmailAccount account, String scope, TokenCache tokenCache) throws Exception {
        return refreshAccessToken(account, scope, tokenCache, false);
    }

    private TokenRefreshResult refreshAccessToken(HotmailAccount account, String scope, TokenCache tokenCache, boolean forceRefresh) throws Exception {
        String cachedAccessToken = forceRefresh ? null : hotmailCredentialCrypto.decrypt(getCachedAccessToken(account, tokenCache));
        String refreshToken = hotmailCredentialCrypto.decrypt(account.getRefreshToken());
        Date cachedExpiresAt = getCachedTokenExpiresAt(account, tokenCache);

        if (!forceRefresh
                && cachedAccessToken != null && !cachedAccessToken.isBlank()
                && cachedExpiresAt != null
                && cachedExpiresAt.getTime() > System.currentTimeMillis() + 60_000) {
            return new TokenRefreshResult(cachedAccessToken, refreshToken, cachedExpiresAt);
        }

        if (account.getClientId() == null || account.getClientId().isBlank()) {
            throw ApiException.badGateway("Token refresh failed: missing client_id");
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            throw ApiException.badGateway("Token refresh failed: missing refresh_token");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", account.getClientId());
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", refreshToken);
        body.add("scope", scope);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(TOKEN_URL, request, String.class);
            JsonNode jsonNode = objectMapper.readTree(response.getBody());

            if (!jsonNode.hasNonNull("access_token")) {
                String errorMsg = jsonNode.has("error_description")
                        ? jsonNode.get("error_description").asText()
                        : "Token refresh failed";
                throw ApiException.badGateway("Token refresh failed: " + errorMsg);
            }

            String newAccessToken = jsonNode.get("access_token").asText();
            String newRefreshToken = jsonNode.hasNonNull("refresh_token")
                    ? jsonNode.get("refresh_token").asText()
                    : refreshToken;
            long expiresInSeconds = jsonNode.hasNonNull("expires_in")
                    ? jsonNode.get("expires_in").asLong(3600)
                    : 3600L;

            Date expiresAt = new Date(System.currentTimeMillis() + expiresInSeconds * 1000);
            return new TokenRefreshResult(newAccessToken, newRefreshToken, expiresAt);
        } catch (RestClientResponseException e) {
            throw ApiException.badGateway("Token refresh request failed: " + getResponseErrorText(e));
        } catch (Exception e) {
            throw ApiException.badGateway("Token refresh request failed: " + e.getMessage());
        }
    }

    private HotmailCodeResult fetchCodeFromGraph(String accessToken, HotmailAccount account, String targetEmail) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.add("Prefer", "outlook.body-content-type=\"text\"");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        Date querySince = buildMessageQuerySince();
        String url = buildMessagesUrl(GRAPH_MESSAGES_URL, GRAPH_FETCH_SIZE, false, false, querySince);
        String fallbackUrl = buildMessagesUrl(GRAPH_MESSAGES_URL, GRAPH_FETCH_SIZE, false, false, null);

        try {
            HotmailCodeResult bestResult = null;
            JsonNode rootMessages = fetchMessagesJson(url, fallbackUrl, request, "Graph");
            bestResult = betterResult(bestResult, findCodeInJsonMessages(account, rootMessages, false, "Graph", "全部邮件", targetEmail));
            if (isRecentResult(bestResult)) {
                return bestResult;
            }
            bestResult = betterResult(
                    bestResult,
                    fetchFullBodyCandidates(account, rootMessages, false, request, GRAPH_MESSAGES_URL, "Graph", "全部邮件", targetEmail)
            );
            if (isRecentResult(bestResult)) {
                return bestResult;
            }

            for (MailboxFolder folder : fetchGraphFolders(request)) {
                try {
                    String folderUrl = buildMessagesUrl(
                            GRAPH_MAIL_FOLDERS_URL + "/" + UriUtils.encodePathSegment(folder.id(), StandardCharsets.UTF_8) + "/messages",
                            FOLDER_FETCH_SIZE,
                            false,
                            false,
                            querySince
                    );
                    String fallbackFolderUrl = buildMessagesUrl(
                            GRAPH_MAIL_FOLDERS_URL + "/" + UriUtils.encodePathSegment(folder.id(), StandardCharsets.UTF_8) + "/messages",
                            FOLDER_FETCH_SIZE,
                            false,
                            false,
                            null
                    );
                    JsonNode folderMessages = fetchMessagesJson(folderUrl, fallbackFolderUrl, request, "Graph");
                    bestResult = betterResult(bestResult, findCodeInJsonMessages(account, folderMessages, false, "Graph", folder.displayName(), targetEmail));
                    if (isRecentResult(bestResult)) {
                        return bestResult;
                    }
                    bestResult = betterResult(
                            bestResult,
                            fetchFullBodyCandidates(account, folderMessages, false, request, GRAPH_MESSAGES_URL, "Graph", folder.displayName(), targetEmail)
                    );
                    if (isRecentResult(bestResult)) {
                        return bestResult;
                    }
                } catch (Exception e) {
                    log.debug("Graph folder message fetch failed: {}", folder.displayName(), e);
                }
            }

            return bestResult != null ? bestResult : buildEmptyResult(account);
        } catch (RestClientResponseException e) {
            throw new Exception("Graph API request failed: " + getResponseErrorText(e), e);
        } catch (Exception e) {
            throw new Exception("Graph API request failed: " + e.getMessage(), e);
        }
    }

    private HotmailCodeResult fetchCodeFromOutlookRest(String accessToken, HotmailAccount account, String targetEmail) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.add("Prefer", "outlook.body-content-type=\"text\"");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        Date querySince = buildMessageQuerySince();
        String url = buildMessagesUrl(OUTLOOK_REST_MESSAGES_URL, GRAPH_FETCH_SIZE, true, false, querySince);
        String fallbackUrl = buildMessagesUrl(OUTLOOK_REST_MESSAGES_URL, GRAPH_FETCH_SIZE, true, false, null);

        try {
            HotmailCodeResult bestResult = null;
            JsonNode rootMessages = fetchMessagesJson(url, fallbackUrl, request, "Outlook REST");
            bestResult = betterResult(bestResult, findCodeInJsonMessages(account, rootMessages, true, "Outlook REST", "全部邮件", targetEmail));
            if (isRecentResult(bestResult)) {
                return bestResult;
            }
            bestResult = betterResult(
                    bestResult,
                    fetchFullBodyCandidates(account, rootMessages, true, request, OUTLOOK_REST_MESSAGES_URL, "Outlook REST", "全部邮件", targetEmail)
            );
            if (isRecentResult(bestResult)) {
                return bestResult;
            }

            for (MailboxFolder folder : fetchOutlookRestFolders(request)) {
                try {
                    String folderUrl = buildMessagesUrl(
                            OUTLOOK_REST_MAIL_FOLDERS_URL + "/" + UriUtils.encodePathSegment(folder.id(), StandardCharsets.UTF_8) + "/messages",
                            FOLDER_FETCH_SIZE,
                            true,
                            false,
                            querySince
                    );
                    String fallbackFolderUrl = buildMessagesUrl(
                            OUTLOOK_REST_MAIL_FOLDERS_URL + "/" + UriUtils.encodePathSegment(folder.id(), StandardCharsets.UTF_8) + "/messages",
                            FOLDER_FETCH_SIZE,
                            true,
                            false,
                            null
                    );
                    JsonNode folderMessages = fetchMessagesJson(folderUrl, fallbackFolderUrl, request, "Outlook REST");
                    bestResult = betterResult(bestResult, findCodeInJsonMessages(account, folderMessages, true, "Outlook REST", folder.displayName(), targetEmail));
                    if (isRecentResult(bestResult)) {
                        return bestResult;
                    }
                    bestResult = betterResult(
                            bestResult,
                            fetchFullBodyCandidates(account, folderMessages, true, request, OUTLOOK_REST_MESSAGES_URL, "Outlook REST", folder.displayName(), targetEmail)
                    );
                    if (isRecentResult(bestResult)) {
                        return bestResult;
                    }
                } catch (Exception e) {
                    log.debug("Outlook REST folder message fetch failed: {}", folder.displayName(), e);
                }
            }

            return bestResult != null ? bestResult : buildEmptyResult(account);
        } catch (RestClientResponseException e) {
            throw new Exception("Outlook REST API request failed: " + getResponseErrorText(e), e);
        } catch (Exception e) {
            throw new Exception("Outlook REST API request failed: " + e.getMessage(), e);
        }
    }

    private JsonNode fetchJson(String url, HttpEntity<Void> request) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(
                URI.create(url),
                HttpMethod.GET,
                request,
                String.class
        );
        return objectMapper.readTree(response.getBody());
    }

    private JsonNode fetchMessagesJson(String url, String fallbackUrl, HttpEntity<Void> request, String source) throws Exception {
        try {
            return fetchJson(url, request);
        } catch (RestClientResponseException e) {
            if (fallbackUrl != null && !fallbackUrl.equals(url)) {
                log.debug("{} recent message query failed, retrying without time filter", source, e);
                return fetchJson(fallbackUrl, request);
            }
            throw e;
        }
    }

    private Date buildMessageQuerySince() {
        long lookbackMinutes = Math.max(1, codeRecentMinutes) + MESSAGE_QUERY_CLOCK_SKEW_MINUTES;
        return new Date(System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(lookbackMinutes));
    }

    private String buildMessagesUrl(String baseUrl, int top, boolean outlookRest, boolean includeBody, Date querySince) {
        String select = outlookRest
                ? "Id,Subject,From,ToRecipients,CcRecipients,BccRecipients,BodyPreview,ReceivedDateTime" + (includeBody ? ",Body" : "")
                : "id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,bodyPreview" + (includeBody ? ",body" : "");
        String url = baseUrl
                + "?$top=" + top
                + "&$orderby=" + (outlookRest ? "ReceivedDateTime" : "receivedDateTime") + "%20desc"
                + "&$select=" + select;
        if (querySince != null) {
            String receivedProperty = outlookRest ? "ReceivedDateTime" : "receivedDateTime";
            String sinceText = querySince.toInstant().truncatedTo(ChronoUnit.SECONDS).toString();
            String filter = receivedProperty + " ge " + sinceText;
            url += "&$filter=" + UriUtils.encodeQueryParam(filter, StandardCharsets.UTF_8);
        }
        return url;
    }

    private String buildSingleMessageUrl(String baseUrl, String messageId, boolean outlookRest) {
        String select = outlookRest
                ? "Id,Subject,From,ToRecipients,CcRecipients,BccRecipients,BodyPreview,Body,ReceivedDateTime"
                : "id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,bodyPreview,body";
        return baseUrl
                + "/" + UriUtils.encodePathSegment(messageId, StandardCharsets.UTF_8)
                + "?$select=" + select;
    }

    private HotmailCodeResult fetchFullBodyCandidates(
            HotmailAccount account,
            JsonNode messages,
            boolean outlookRest,
            HttpEntity<Void> request,
            String singleMessageBaseUrl,
            String source,
            String folder,
            String targetEmail
    ) {
        if (messages == null || !messages.has("value")) {
            return null;
        }

        HotmailCodeResult bestResult = null;
        int fetchedCount = 0;
        for (JsonNode message : messages.get("value")) {
            if (fetchedCount >= FULL_BODY_CANDIDATE_LIMIT) {
                break;
            }
            if (!shouldFetchFullBody(message, outlookRest)) {
                continue;
            }

            String messageId = message.path(outlookRest ? "Id" : "id").asText("");
            if (messageId.isBlank()) {
                continue;
            }

            try {
                fetchedCount++;
                JsonNode fullMessage = fetchJson(buildSingleMessageUrl(singleMessageBaseUrl, messageId, outlookRest), request);
                bestResult = betterResult(bestResult, findCodeInJsonMessage(account, fullMessage, outlookRest, source, folder, targetEmail));
            } catch (Exception e) {
                log.debug(source + " full body fetch failed: " + messageId, e);
            }
        }
        return bestResult;
    }

    private boolean shouldFetchFullBody(JsonNode message, boolean outlookRest) {
        String subject = message.path(outlookRest ? "Subject" : "subject").asText("");
        String bodyPreview = message.path(outlookRest ? "BodyPreview" : "bodyPreview").asText("");
        JsonNode fromEmail = outlookRest
                ? message.path("From").path("EmailAddress")
                : message.path("from").path("emailAddress");
        String sender = fromEmail.path(outlookRest ? "Address" : "address").asText("")
                + " "
                + fromEmail.path(outlookRest ? "Name" : "name").asText("");
        String text = subject + "\n" + bodyPreview + "\n" + sender;
        return containsVerificationKeyword(text)
                || text.toLowerCase(Locale.ROOT).contains("openai")
                || text.toLowerCase(Locale.ROOT).contains("microsoft account");
    }

    private List<MailboxFolder> fetchGraphFolders(HttpEntity<Void> request) {
        try {
            JsonNode jsonNode = fetchJson(
                    GRAPH_MAIL_FOLDERS_URL + "?$top=" + MAX_FOLDER_FETCHES + "&$select=id,displayName",
                    request
            );
            return parseFolders(jsonNode, false);
        } catch (Exception e) {
            log.debug("Graph folder listing failed", e);
            return List.of();
        }
    }

    private List<MailboxFolder> fetchOutlookRestFolders(HttpEntity<Void> request) {
        try {
            JsonNode jsonNode = fetchJson(
                    OUTLOOK_REST_MAIL_FOLDERS_URL + "?$top=" + MAX_FOLDER_FETCHES + "&$select=Id,DisplayName",
                    request
            );
            return parseFolders(jsonNode, true);
        } catch (Exception e) {
            log.debug("Outlook REST folder listing failed", e);
            return List.of();
        }
    }

    private List<MailboxFolder> parseFolders(JsonNode jsonNode, boolean outlookRest) {
        if (jsonNode == null || !jsonNode.has("value")) {
            return List.of();
        }

        List<MailboxFolder> folders = new ArrayList<>();
        for (JsonNode folder : jsonNode.get("value")) {
            String id = folder.path(outlookRest ? "Id" : "id").asText("");
            String displayName = folder.path(outlookRest ? "DisplayName" : "displayName").asText("");
            if (id.isBlank()) {
                continue;
            }
            folders.add(new MailboxFolder(id, displayName.isBlank() ? id : displayName));
        }
        return folders.stream()
                .sorted(Comparator.comparingInt((MailboxFolder folder) -> mailFolderPriority(folder.displayName()))
                        .thenComparing(MailboxFolder::displayName))
                .limit(MAX_FOLDER_FETCHES)
                .toList();
    }

    private int mailFolderPriority(String folderName) {
        String name = folderName == null ? "" : folderName.toLowerCase(Locale.ROOT);
        if (name.equals("inbox") || name.contains("收件")) {
            return 0;
        }
        if (name.contains("junk") || name.contains("spam") || name.contains("垃圾")) {
            return 1;
        }
        if (name.contains("archive") || name.contains("归档")) {
            return 2;
        }
        if (name.contains("deleted") || name.contains("trash") || name.contains("已删除")) {
            return 3;
        }
        if (name.contains("sent") || name.contains("draft") || name.contains("outbox")
                || name.contains("已发送") || name.contains("草稿") || name.contains("发件")) {
            return 50;
        }
        return 20;
    }

    private HotmailCodeResult findCodeInJsonMessages(
            HotmailAccount account,
            JsonNode jsonNode,
            boolean outlookRest,
            String source,
            String folder,
            String targetEmail
    ) {
        if (jsonNode == null || !jsonNode.has("value")) {
            return null;
        }

        HotmailCodeResult bestResult = null;
        for (JsonNode message : jsonNode.get("value")) {
            bestResult = betterResult(bestResult, findCodeInJsonMessage(account, message, outlookRest, source, folder, targetEmail));
        }
        return bestResult;
    }

    private HotmailCodeResult findCodeInJsonMessage(
            HotmailAccount account,
            JsonNode message,
            boolean outlookRest,
            String source,
            String folder,
            String targetEmail
    ) {
        if (message == null || message.isMissingNode() || message.isNull()) {
            return null;
        }
        if (!isJsonMessageForTarget(message, outlookRest, targetEmail)) {
            return null;
        }

        String subject = message.path(outlookRest ? "Subject" : "subject").asText("");
        String bodyPreview = message.path(outlookRest ? "BodyPreview" : "bodyPreview").asText("");
        String bodyContent = message.path(outlookRest ? "Body" : "body").path(outlookRest ? "Content" : "content").asText("");
        String extractedCode = extractCode(subject + "\n" + bodyPreview + "\n" + bodyContent);
        if (extractedCode == null) {
            return null;
        }

        return buildResultFromJsonMessage(account, message, outlookRest, source, folder, subject, extractedCode);
    }

    private HotmailCodeResult buildResultFromJsonMessage(
            HotmailAccount account,
            JsonNode message,
            boolean outlookRest,
            String source,
            String folder,
            String subject,
            String code
    ) {
        HotmailCodeResult result = new HotmailCodeResult();
        result.setAccountId(account.getId());
        result.setEmail(account.getEmail());
        result.setCode(code);
        result.setSubject(subject);
        result.setFound(true);
        result.setSource(source);
        result.setFolder(folder);

        JsonNode fromEmail = outlookRest
                ? message.path("From").path("EmailAddress")
                : message.path("from").path("emailAddress");
        result.setSender(fromEmail.path(outlookRest ? "Address" : "address").asText(""));
        result.setReceivedTime(parseGraphDate(message.path(outlookRest ? "ReceivedDateTime" : "receivedDateTime").asText(null)));
        return result;
    }

    private boolean isJsonMessageForTarget(JsonNode message, boolean outlookRest, String targetEmail) {
        if (targetEmail == null || targetEmail.isBlank()) {
            return true;
        }

        boolean hasRecipient = false;
        String[] recipientFields = outlookRest
                ? new String[]{"ToRecipients", "CcRecipients", "BccRecipients"}
                : new String[]{"toRecipients", "ccRecipients", "bccRecipients"};
        for (String recipientField : recipientFields) {
            JsonNode recipients = message.path(recipientField);
            if (!recipients.isArray()) {
                continue;
            }
            for (JsonNode recipient : recipients) {
                String address = recipient.path(outlookRest ? "EmailAddress" : "emailAddress")
                        .path(outlookRest ? "Address" : "address")
                        .asText("");
                if (address.isBlank()) {
                    continue;
                }
                hasRecipient = true;
                if (targetEmail.equals(normalizeEmail(address))) {
                    return true;
                }
            }
        }

        return !hasRecipient;
    }

    private HotmailCodeResult fetchCodeFromImap(String accessToken, HotmailAccount account, String targetEmail) throws Exception {
        Properties properties = new Properties();
        properties.put("mail.store.protocol", "imap");
        properties.put("mail.imap.host", OUTLOOK_IMAP_HOST);
        properties.put("mail.imap.port", "993");
        properties.put("mail.imap.ssl.enable", "true");
        properties.put("mail.imap.auth.mechanisms", "XOAUTH2");
        properties.put("mail.imap.auth.login.disable", "true");
        properties.put("mail.imap.auth.plain.disable", "true");
        properties.put("mail.imap.connectiontimeout", "12000");
        properties.put("mail.imap.timeout", "12000");
        properties.put("mail.imap.writetimeout", "12000");

        Session session = Session.getInstance(properties);
        Store store = session.getStore("imap");

        try {
            store.connect(OUTLOOK_IMAP_HOST, 993, account.getEmail(), accessToken);
            HotmailCodeResult bestResult = null;

            for (Folder folder : getImapFolders(store)) {
                bestResult = betterResult(bestResult, fetchCodeFromImapFolder(account, folder, targetEmail));
                if (isRecentResult(bestResult)) {
                    return bestResult;
                }
            }

            return bestResult != null ? bestResult : buildEmptyResult(account);
        } finally {
            try {
                store.close();
            } catch (Exception ignored) {
            }
        }
    }

    private List<Folder> getImapFolders(Store store) throws Exception {
        Map<String, Folder> foldersByName = new LinkedHashMap<>();
        addImapFolder(foldersByName, store.getFolder("INBOX"));

        Folder defaultFolder = store.getDefaultFolder();
        for (Folder folder : defaultFolder.list("*")) {
            addImapFolder(foldersByName, folder);
        }

        return foldersByName.values().stream()
                .filter(this::isMessageFolder)
                .sorted(Comparator.comparingInt(this::imapFolderPriority))
                .limit(MAX_IMAP_FOLDERS)
                .toList();
    }

    private void addImapFolder(Map<String, Folder> foldersByName, Folder folder) {
        try {
            if (folder != null && folder.exists()) {
                foldersByName.putIfAbsent(folder.getFullName(), folder);
            }
        } catch (Exception ignored) {
        }
    }

    private boolean isMessageFolder(Folder folder) {
        try {
            return folder.exists() && (folder.getType() & Folder.HOLDS_MESSAGES) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    private int imapFolderPriority(Folder folder) {
        String name;
        try {
            name = folder.getFullName().toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            return 100;
        }
        if (name.equals("inbox") || name.contains("收件")) {
            return 0;
        }
        if (name.contains("junk") || name.contains("spam") || name.contains("垃圾")) {
            return 1;
        }
        if (name.contains("archive") || name.contains("归档")) {
            return 2;
        }
        if (name.contains("deleted") || name.contains("trash") || name.contains("已删除")) {
            return 3;
        }
        return 20;
    }

    private HotmailCodeResult fetchCodeFromImapFolder(HotmailAccount account, Folder folder, String targetEmail) {
        try {
            folder.open(Folder.READ_ONLY);
            int count = folder.getMessageCount();
            if (count <= 0) {
                return null;
            }

            int start = Math.max(1, count - IMAP_FETCH_SIZE + 1);
            Message[] messages = folder.getMessages(start, count);
            HotmailCodeResult bestResult = null;
            int fallbackBodyReads = 0;
            for (int index = messages.length - 1; index >= 0; index--) {
                Message message = messages[index];
                if (!isImapMessageForTarget(message, targetEmail)) {
                    continue;
                }
                String subject = message.getSubject() == null ? "" : message.getSubject();
                String extractedCode = extractCode(subject);
                if (extractedCode == null && (containsVerificationKeyword(subject) || fallbackBodyReads < IMAP_BODY_FALLBACK_LIMIT)) {
                    fallbackBodyReads++;
                    String body = extractTextFromPart(message);
                    extractedCode = extractCode(subject + "\n" + body);
                }
                if (extractedCode == null) {
                    continue;
                }

                HotmailCodeResult candidate = buildResultFromImapMessage(account, message, folder.getFullName(), subject, extractedCode);
                bestResult = betterResult(bestResult, candidate);
            }
            return bestResult;
        } catch (Exception e) {
            log.debug("IMAP folder scan failed: {}", safeFolderName(folder), e);
            return null;
        } finally {
            try {
                if (folder.isOpen()) {
                    folder.close(false);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private HotmailCodeResult buildResultFromImapMessage(
            HotmailAccount account,
            Message message,
            String folder,
            String subject,
            String code
    ) throws Exception {
        HotmailCodeResult result = new HotmailCodeResult();
        result.setAccountId(account.getId());
        result.setEmail(account.getEmail());
        result.setCode(code);
        result.setSubject(subject);
        result.setFound(true);
        result.setSource("IMAP");
        result.setFolder(folder);

        Address[] from = message.getFrom();
        if (from != null && from.length > 0) {
            Address first = from[0];
            result.setSender(first instanceof InternetAddress internetAddress ? internetAddress.getAddress() : first.toString());
        }

        Date receivedDate = message.getReceivedDate();
        result.setReceivedTime(receivedDate != null ? receivedDate : message.getSentDate());
        return result;
    }

    private boolean isImapMessageForTarget(Message message, String targetEmail) {
        if (targetEmail == null || targetEmail.isBlank()) {
            return true;
        }

        try {
            Address[] recipients = message.getAllRecipients();
            if (recipients == null || recipients.length == 0) {
                return true;
            }
            for (Address recipient : recipients) {
                String address = recipient instanceof InternetAddress internetAddress
                        ? internetAddress.getAddress()
                        : recipient.toString();
                if (targetEmail.equals(normalizeEmail(address))) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    private String extractTextFromPart(Part part) throws Exception {
        if (part.isMimeType("text/plain") || part.isMimeType("text/html")) {
            Object content = part.getContent();
            return content == null ? "" : content.toString();
        }

        if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            StringBuilder text = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                text.append('\n').append(extractTextFromPart(multipart.getBodyPart(i)));
            }
            return text.toString();
        }

        if (part.isMimeType("message/rfc822")) {
            Object content = part.getContent();
            if (content instanceof Part nestedPart) {
                return extractTextFromPart(nestedPart);
            }
        }

        return "";
    }

    private String safeFolderName(Folder folder) {
        try {
            return folder == null ? "" : folder.getFullName();
        } catch (Exception e) {
            return "";
        }
    }

    private String extractCode(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        String normalizedText = normalizeMessageText(text);

        Matcher contextualMatcher = CONTEXTUAL_CODE_PATTERN.matcher(normalizedText);
        if (contextualMatcher.find()) {
            return contextualMatcher.group(1);
        }

        boolean containsKeyword = containsVerificationKeyword(normalizedText);
        if (containsKeyword) {
            String spacedNumericCode = findSpacedNumericCode(normalizedText);
            if (spacedNumericCode != null) {
                return spacedNumericCode;
            }

            String numericCode = findFirstMatch(STRICT_NUMERIC_CODE_PATTERN, normalizedText);
            if (numericCode != null) {
                return numericCode;
            }

            String hyphenatedAlphanumericCode = findFirstHyphenatedCode(normalizedText);
            if (hyphenatedAlphanumericCode != null) {
                return hyphenatedAlphanumericCode;
            }

            String alphanumericCode = findFirstCodeWithDigit(GENERAL_ALPHANUMERIC_CODE_PATTERN, normalizedText);
            if (alphanumericCode != null) {
                return alphanumericCode;
            }

            return findFirstNonYearNumericCode(normalizedText);
        }

        return findFirstMatch(STRICT_NUMERIC_CODE_PATTERN, normalizedText);
    }

    private String findSpacedNumericCode(String text) {
        Matcher matcher = SPACED_NUMERIC_CODE_PATTERN.matcher(text);
        while (matcher.find()) {
            String digits = matcher.group(1).replaceAll("\\s+", "");
            if (digits.length() >= 4 && digits.length() <= 8) {
                return digits;
            }
        }
        return null;
    }

    private String findFirstMatch(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String findFirstCodeWithDigit(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String candidate = matcher.group(1);
            if (candidate != null && candidate.matches(".*\\d.*")) {
                return candidate;
            }
        }
        return null;
    }

    private String findFirstHyphenatedCode(String text) {
        Matcher matcher = HYPHENATED_ALPHANUMERIC_CODE_PATTERN.matcher(text);
        while (matcher.find()) {
            String candidate = normalizeHyphenatedCode(matcher.group(1));
            if (candidate.matches(".*\\d.*")) {
                return candidate;
            }
        }
        return null;
    }

    private String normalizeHyphenatedCode(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").replace('\u2013', '-').replace('\u2014', '-');
    }

    private String findFirstNonYearNumericCode(String text) {
        Matcher matcher = GENERAL_NUMERIC_CODE_PATTERN.matcher(text);
        while (matcher.find()) {
            String candidate = matcher.group(1);
            if (!isLikelyYear(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private boolean isLikelyYear(String value) {
        if (value == null || value.length() != 4) {
            return false;
        }
        try {
            int year = Integer.parseInt(value);
            return year >= 1900 && year <= 2099;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String normalizeMessageText(String text) {
        String withoutTags = text
                .replaceAll("(?is)<(script|style)[^>]*>.*?</\\1>", " ")
                .replaceAll("(?s)<[^>]+>", " ");
        String unescaped = HtmlUtils.htmlUnescape(withoutTags);
        return unescaped.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private ParsedHotmailAccount parseImportLine(String line) {
        String[] parts = line.split("----", -1);
        int effectiveLength = getImportEffectiveLength(parts);
        int accountStart = findImportAccountStart(parts, effectiveLength);
        int accountPartCount = effectiveLength - accountStart;
        if (accountPartCount >= 4) {
            return new ParsedHotmailAccount(
                    normalizeEmail(parts[accountStart]),
                    cleanPassword(parts[accountStart + 1]),
                    parts[accountStart + 2].trim(),
                    cleanRefreshToken(joinImportParts(parts, accountStart + 3, effectiveLength)),
                    null
            );
        }
        if (accountPartCount == 3) {
            return new ParsedHotmailAccount(
                    normalizeEmail(parts[accountStart]),
                    null,
                    parts[accountStart + 1].trim(),
                    cleanRefreshToken(parts[accountStart + 2]),
                    null
            );
        }

        String email = effectiveLength > 0 && accountStart < effectiveLength ? normalizeEmail(parts[accountStart]) : null;
        return new ParsedHotmailAccount(email, null, null, null, "格式不正确，应为 邮箱----密码----client_id----refresh_token、邮箱----client_id----refresh_token，或带末尾 ----0 的同类格式");
    }

    private int getImportEffectiveLength(String[] parts) {
        int effectiveLength = parts.length;
        if (effectiveLength > 3 && IMPORT_STATUS_PATTERN.matcher(parts[effectiveLength - 1].trim()).matches()) {
            effectiveLength--;
        }
        return effectiveLength;
    }

    private int findImportAccountStart(String[] parts, int effectiveLength) {
        if (effectiveLength <= 3) {
            return 0;
        }

        String firstEmail = normalizeEmail(parts[0]);
        int fallbackEmailIndex = 0;
        for (int i = effectiveLength - 3; i > 0; i--) {
            String candidateEmail = normalizeEmail(parts[i]);
            if (!isValidEmail(candidateEmail)) {
                continue;
            }
            if (isValidEmail(firstEmail) && candidateEmail.equals(firstEmail)) {
                return i;
            }
            if (fallbackEmailIndex == 0) {
                fallbackEmailIndex = i;
            }
        }
        return fallbackEmailIndex;
    }

    private String joinImportParts(String[] parts, int startInclusive, int endExclusive) {
        if (startInclusive >= endExclusive) {
            return "";
        }

        StringBuilder joined = new StringBuilder(parts[startInclusive]);
        for (int i = startInclusive + 1; i < endExclusive; i++) {
            joined.append("----").append(parts[i]);
        }
        return joined.toString();
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private String cleanRefreshToken(String refreshToken) {
        return refreshToken == null ? null : refreshToken.trim().replace("$$", "");
    }

    private String cleanPassword(String password) {
        if (password == null) {
            return null;
        }
        String cleaned = password.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private String normalizeSubEmails(String subEmails, String mainEmail) {
        if (subEmails == null || subEmails.isBlank()) {
            return null;
        }

        String normalizedMainEmail = normalizeEmail(mainEmail);
        List<String> normalizedEmails = new ArrayList<>();
        String[] candidates = subEmails.split("[,;\\s，；、]+");
        for (String candidate : candidates) {
            String email = normalizeEmail(candidate);
            if (email == null || email.isBlank()) {
                continue;
            }
            if (!isValidEmail(email)) {
                throw ApiException.badRequest("子邮箱格式不正确：" + candidate.trim());
            }
            if (email.equals(normalizedMainEmail) || normalizedEmails.contains(email)) {
                continue;
            }
            normalizedEmails.add(email);
            if (normalizedEmails.size() > 50) {
                throw ApiException.badRequest("子邮箱最多支持 50 个");
            }
        }

        if (normalizedEmails.isEmpty()) {
            return null;
        }

        String result = String.join("\n", normalizedEmails);
        if (result.length() > 4000) {
            throw ApiException.badRequest("子邮箱内容过长");
        }
        return result;
    }

    private String normalizeRegisteredSubEmails(String registeredSubEmails, String subEmails) {
        if (registeredSubEmails == null || registeredSubEmails.isBlank() || subEmails == null || subEmails.isBlank()) {
            return null;
        }

        List<String> availableSubEmails = parseEmailList(subEmails);
        List<String> normalizedRegisteredEmails = new ArrayList<>();
        for (String email : parseEmailList(registeredSubEmails)) {
            if (availableSubEmails.contains(email) && !normalizedRegisteredEmails.contains(email)) {
                normalizedRegisteredEmails.add(email);
            }
        }

        return normalizedRegisteredEmails.isEmpty() ? null : String.join("\n", normalizedRegisteredEmails);
    }

    private List<String> parseEmailList(String emails) {
        if (emails == null || emails.isBlank()) {
            return List.of();
        }

        List<String> result = new ArrayList<>();
        String[] candidates = emails.split("[,;\\s，；、]+");
        for (String candidate : candidates) {
            String email = normalizeEmail(candidate);
            if (email != null && !email.isBlank() && isValidEmail(email) && !result.contains(email)) {
                result.add(email);
            }
        }
        return result;
    }

    private List<Long> normalizeAccountIds(List<Long> accountIds) {
        if (accountIds == null) {
            return List.of();
        }
        List<Long> requestedIds = new ArrayList<>();
        for (Long accountId : accountIds) {
            if (accountId != null && accountId > 0 && !requestedIds.contains(accountId)) {
                requestedIds.add(accountId);
            }
        }
        return requestedIds;
    }

    private List<HotmailAccount> getAccountsForBatch(Long userId, List<Long> accountIds) {
        List<Long> requestedIds = normalizeAccountIds(accountIds);
        if (accountIds != null && requestedIds.isEmpty()) {
            return List.of();
        }

        LambdaQueryWrapper<HotmailAccount> queryWrapper = new LambdaQueryWrapper<HotmailAccount>()
                .eq(HotmailAccount::getUserId, userId)
                .orderByAsc(HotmailAccount::getGroupName)
                .orderByDesc(HotmailAccount::getUpdateTime)
                .orderByDesc(HotmailAccount::getCreateTime);
        if (accountIds != null) {
            queryWrapper.in(HotmailAccount::getId, requestedIds);
        }

        List<HotmailAccount> accounts = hotmailAccountMapper.selectList(queryWrapper);
        if (accountIds != null) {
            Map<Long, Integer> orderById = new LinkedHashMap<>();
            for (int index = 0; index < requestedIds.size(); index++) {
                orderById.put(requestedIds.get(index), index);
            }
            accounts.sort(Comparator.comparingInt(account -> orderById.getOrDefault(account.getId(), Integer.MAX_VALUE)));
        }
        return accounts;
    }

    private List<HotmailAccount> getAccountsByIds(Long userId, List<Long> accountIds) {
        return getAccountsForBatch(userId, accountIds);
    }

    private String normalizeGroupName(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : truncate(normalized, 80);
    }

    private void resetTokenCheck(HotmailAccount account) {
        account.setTokenCheckStatus(TOKEN_CHECK_UNKNOWN);
        account.setGraphTokenOk(null);
        account.setOutlookTokenOk(null);
        account.setImapTokenOk(null);
        account.setTokenCheckSummary(null);
        account.setTokenCheckedAt(null);
    }

    private HotmailAccount getOwnedAccount(Long userId, Long accountId) {
        HotmailAccount account = hotmailAccountMapper.selectById(accountId);
        if (account == null || !account.getUserId().equals(userId)) {
            throw ApiException.notFound("Mailbox account not found");
        }
        return account;
    }

    private HotmailAccount ensurePublicCodeUid(HotmailAccount account) {
        if (account == null
                || !Boolean.TRUE.equals(account.getPublicCodeEnabled())
                || account.getPublicCodeToken() == null
                || account.getPublicCodeToken().isBlank()
                || (account.getPublicCodeUid() != null && !account.getPublicCodeUid().isBlank())) {
            return account;
        }

        String uid = generateUniquePublicCodeUid();
        Date now = new Date();
        hotmailAccountMapper.update(
                null,
                new UpdateWrapper<HotmailAccount>()
                        .eq("id", account.getId())
                        .eq("public_code_token", account.getPublicCodeToken())
                        .eq("public_code_enabled", true)
                        .isNull("public_code_uid")
                        .set("public_code_uid", uid)
                        .set("update_time", now)
        );
        account.setPublicCodeUid(uid);
        account.setUpdateTime(now);
        return account;
    }

    private String normalizePublicTargetEmail(HotmailAccount account, String targetEmail) {
        String normalizedEmail = normalizeEmail(targetEmail);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            normalizedEmail = normalizeEmail(account.getEmail());
        }
        if (!isValidEmail(normalizedEmail)) {
            throw ApiException.badRequest("目标邮箱格式不正确");
        }

        String accountEmail = normalizeEmail(account.getEmail());
        if (normalizedEmail.equals(accountEmail)) {
            return normalizedEmail;
        }

        List<String> subEmails = parseEmailList(account.getSubEmails());
        if (!subEmails.contains(normalizedEmail)) {
            throw ApiException.badRequest("目标邮箱必须是主邮箱或已维护的子邮箱");
        }
        return normalizedEmail;
    }

    private String generateUniquePublicCodeToken() {
        for (int attempt = 0; attempt < PUBLIC_CODE_TOKEN_GENERATE_RETRIES; attempt++) {
            String token = generatePublicCodeToken();
            Long count = hotmailAccountMapper.selectCount(
                    new LambdaQueryWrapper<HotmailAccount>()
                            .eq(HotmailAccount::getPublicCodeToken, token)
            );
            if (count == null || count == 0) {
                return token;
            }
        }
        throw ApiException.badGateway("公开取码链接生成失败，请稍后重试");
    }

    private String generateUniquePublicCodeUid() {
        for (int attempt = 0; attempt < PUBLIC_CODE_UID_GENERATE_RETRIES; attempt++) {
            String uid = generatePublicCodeUid();
            Long count = hotmailAccountMapper.selectCount(
                    new LambdaQueryWrapper<HotmailAccount>()
                            .eq(HotmailAccount::getPublicCodeUid, uid)
            );
            if (count == null || count == 0) {
                return uid;
            }
        }
        throw ApiException.badGateway("公开取码链接生成失败，请稍后重试");
    }

    private String generatePublicCodeToken() {
        return generateRandomHex(PUBLIC_CODE_TOKEN_BYTES);
    }

    private String generatePublicCodeUid() {
        return generateRandomHex(PUBLIC_CODE_UID_BYTES);
    }

    private String generateRandomHex(int byteCount) {
        byte[] randomBytes = new byte[byteCount];
        secureRandom.nextBytes(randomBytes);
        char[] result = new char[byteCount * 2];
        for (int index = 0; index < randomBytes.length; index++) {
            int value = randomBytes[index] & 0xff;
            result[index * 2] = HEX_CHARS[value >>> 4];
            result[index * 2 + 1] = HEX_CHARS[value & 0x0f];
        }
        return new String(result);
    }

    private static Object[] buildPublicCodeFetchLocks() {
        Object[] locks = new Object[PUBLIC_CODE_FETCH_LOCK_STRIPES];
        for (int index = 0; index < locks.length; index++) {
            locks[index] = new Object();
        }
        return locks;
    }

    private Object getPublicCodeFetchLock(Long accountId) {
        return publicCodeFetchLocks[Math.floorMod(accountId == null ? 0 : accountId.hashCode(), publicCodeFetchLocks.length)];
    }

    private HotmailAccount findPublicCodeAccount(String token) {
        return hotmailAccountMapper.selectOne(
                new LambdaQueryWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getPublicCodeToken, token)
                        .eq(HotmailAccount::getPublicCodeEnabled, true)
                        .last("LIMIT 1")
        );
    }

    private HotmailAccount findPublicCodeAccount(String token, String uid) {
        return hotmailAccountMapper.selectOne(
                new LambdaQueryWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getPublicCodeToken, token)
                        .eq(HotmailAccount::getPublicCodeUid, uid)
                        .eq(HotmailAccount::getPublicCodeEnabled, true)
                        .last("LIMIT 1")
        );
    }

    private void requirePublicCodeRateLimit(String token) {
        if (publicCodeRateLimitPerMinute <= 0) {
            return;
        }

        long now = System.currentTimeMillis();
        if (publicCodeRateLimitWindows.size() > PUBLIC_CODE_RATE_LIMITER_MAX_KEYS) {
            cleanupPublicCodeRateLimitWindows(now);
            if (!publicCodeRateLimitWindows.containsKey(token)
                    && publicCodeRateLimitWindows.size() > PUBLIC_CODE_RATE_LIMITER_MAX_KEYS) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁，请稍后再试");
            }
        }

        PublicCodeRateLimitWindow window = publicCodeRateLimitWindows.computeIfAbsent(token, ignored -> new PublicCodeRateLimitWindow(now));
        synchronized (window) {
            if (now - window.windowStartMillis >= PUBLIC_CODE_RATE_LIMIT_WINDOW_MILLIS) {
                window.windowStartMillis = now;
                window.count = 0;
            }
            window.lastAccessMillis = now;
            if (window.count >= publicCodeRateLimitPerMinute) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁，请稍后再试");
            }
            window.count++;
        }
    }

    private void cleanupPublicCodeRateLimitWindows(long now) {
        publicCodeRateLimitWindows.entrySet().removeIf(entry -> now - entry.getValue().lastAccessMillis > PUBLIC_CODE_RATE_LIMIT_IDLE_MILLIS);
    }

    private boolean shouldUseCachedPublicResult(HotmailAccount account) {
        if (publicCodeFetchCooldownSeconds <= 0 || account.getLastFetchTime() == null) {
            return false;
        }
        if (account.getPublicCodeCreatedAt() != null && account.getLastFetchTime().before(account.getPublicCodeCreatedAt())) {
            return false;
        }
        if (account.getPublicCodeLastAccessTime() == null || account.getLastFetchTime().after(account.getPublicCodeLastAccessTime())) {
            return false;
        }
        long cooldownMillis = TimeUnit.SECONDS.toMillis(publicCodeFetchCooldownSeconds);
        long elapsedMillis = System.currentTimeMillis() - account.getLastFetchTime().getTime();
        return elapsedMillis >= 0 && elapsedMillis < cooldownMillis && hasCachedPublicResult(account);
    }

    private boolean hasCachedPublicResult(HotmailAccount account) {
        return (account.getLastError() != null && !account.getLastError().isBlank())
                || (account.getLastCode() != null && !account.getLastCode().isBlank());
    }

    private HotmailCodeResult buildCachedPublicCodeResult(HotmailAccount account) {
        HotmailCodeResult result = new HotmailCodeResult();
        result.setEmail(getPublicCodeResponseEmail(account));
        result.setFetchTime(account.getLastFetchTime());
        result.setReceivedTime(account.getLastCodeTime());
        result.setSource(account.getLastSource());
        result.setFolder(account.getLastFolder());

        boolean hasError = account.getLastError() != null && !account.getLastError().isBlank();
        boolean found = !hasError && account.getLastCode() != null && !account.getLastCode().isBlank();
        result.setFound(found);
        if (found) {
            result.setCode(account.getLastCode());
            result.setSubject(account.getLastSubject());
            result.setSender(account.getLastSender());
        } else {
            result.setError(hasError ? account.getLastError() : "最近邮件中未找到验证码");
        }
        return result;
    }

    private String getPublicCodeResponseEmail(HotmailAccount account) {
        String targetEmail = account.getPublicCodeTargetEmail();
        return targetEmail != null && !targetEmail.isBlank() ? targetEmail : account.getEmail();
    }

    private PublicMailCodeResult toPublicMailCodeResult(HotmailAccount account, HotmailCodeResult result) {
        PublicMailCodeResult publicResult = new PublicMailCodeResult();
        publicResult.setEmail(getPublicCodeResponseEmail(account));
        publicResult.setFound(result != null && result.isFound());
        if (result == null) {
            publicResult.setError("最近邮件中未找到验证码");
            publicResult.setFetchTime(new Date());
            return publicResult;
        }

        publicResult.setCode(result.getCode());
        publicResult.setReceivedTime(result.getReceivedTime());
        publicResult.setFetchTime(result.getFetchTime());
        publicResult.setSource(result.getSource());
        publicResult.setError(result.getError());
        return publicResult;
    }

    private void touchPublicCodeAccess(HotmailAccount account, boolean force) {
        if (account == null || account.getId() == null) {
            return;
        }
        if (!force && !shouldTouchPublicCodeAccess(account)) {
            return;
        }
        Date now = new Date();
        hotmailAccountMapper.update(
                null,
                new LambdaUpdateWrapper<HotmailAccount>()
                        .eq(HotmailAccount::getId, account.getId())
                        .set(HotmailAccount::getPublicCodeLastAccessTime, now)
                        .setSql("update_time = update_time")
        );
    }

    private boolean shouldTouchPublicCodeAccess(HotmailAccount account) {
        if (publicCodeAccessTouchIntervalSeconds <= 0 || account.getPublicCodeLastAccessTime() == null) {
            return true;
        }
        long touchIntervalMillis = TimeUnit.SECONDS.toMillis(publicCodeAccessTouchIntervalSeconds);
        long elapsedMillis = System.currentTimeMillis() - account.getPublicCodeLastAccessTime().getTime();
        return elapsedMillis < 0 || elapsedMillis >= touchIntervalMillis;
    }

    private void persistFetchResult(
            HotmailAccount account,
            TokenRefreshResult graphToken,
            TokenRefreshResult outlookToken,
            TokenRefreshResult imapToken,
            TokenRefreshResult latestToken,
            HotmailCodeResult result
    ) {
        Date fetchTime = new Date();
        if (result != null) {
            result.setFetchTime(fetchTime);
        }
        TokenRefreshResult refreshTokenSource = latestToken != null ? latestToken : graphToken;
        if (refreshTokenSource != null && refreshTokenSource.refreshToken() != null && !refreshTokenSource.refreshToken().isBlank()) {
            account.setRefreshToken(hotmailCredentialCrypto.encrypt(refreshTokenSource.refreshToken()));
        }
        if (graphToken != null) {
            setCachedToken(account, TokenCache.GRAPH, graphToken);
        }
        if (outlookToken != null) {
            setCachedToken(account, TokenCache.OUTLOOK_REST, outlookToken);
        }
        if (imapToken != null) {
            setCachedToken(account, TokenCache.IMAP, imapToken);
        }
        if (result != null) {
            account.setLastSource(truncate(result.getSource(), 80));
            account.setLastFolder(truncate(result.getFolder(), 255));
            account.setLastFetchTime(fetchTime);
            if (result.isFound()) {
                account.setLastCode(result.getCode());
                account.setLastCodeTime(result.getReceivedTime());
                account.setLastSubject(truncate(result.getSubject(), 500));
                account.setLastSender(truncate(result.getSender(), 255));
                account.setLastError(null);
            } else {
                account.setLastError(truncate(result.getError(), 600));
            }
        }
        account.setUpdateTime(new Date());
        hotmailAccountMapper.updateById(account);
    }

    private String getCachedAccessToken(HotmailAccount account, TokenCache tokenCache) {
        return switch (tokenCache) {
            case GRAPH -> account.getAccessToken();
            case OUTLOOK_REST -> account.getOutlookAccessToken();
            case IMAP -> account.getImapAccessToken();
        };
    }

    private Date getCachedTokenExpiresAt(HotmailAccount account, TokenCache tokenCache) {
        return switch (tokenCache) {
            case GRAPH -> account.getTokenExpiresAt();
            case OUTLOOK_REST -> account.getOutlookTokenExpiresAt();
            case IMAP -> account.getImapTokenExpiresAt();
        };
    }

    private void setCachedToken(HotmailAccount account, TokenCache tokenCache, TokenRefreshResult tokenRefreshResult) {
        if (tokenRefreshResult.accessToken() == null || tokenRefreshResult.accessToken().isBlank()) {
            return;
        }

        String encryptedAccessToken = hotmailCredentialCrypto.encrypt(tokenRefreshResult.accessToken());
        switch (tokenCache) {
            case GRAPH -> {
                account.setAccessToken(encryptedAccessToken);
                account.setTokenExpiresAt(tokenRefreshResult.expiresAt());
            }
            case OUTLOOK_REST -> {
                account.setOutlookAccessToken(encryptedAccessToken);
                account.setOutlookTokenExpiresAt(tokenRefreshResult.expiresAt());
            }
            case IMAP -> {
                account.setImapAccessToken(encryptedAccessToken);
                account.setImapTokenExpiresAt(tokenRefreshResult.expiresAt());
            }
        }
    }

    private HotmailCodeResult betterResult(HotmailCodeResult current, HotmailCodeResult candidate) {
        if (candidate == null || !candidate.isFound()) {
            return current;
        }
        if (current == null || !current.isFound()) {
            return candidate;
        }

        Date currentTime = current.getReceivedTime();
        Date candidateTime = candidate.getReceivedTime();
        if (currentTime == null) {
            return candidate;
        }
        if (candidateTime == null) {
            return current;
        }
        return candidateTime.after(currentTime) ? candidate : current;
    }

    private boolean isRecentResult(HotmailCodeResult result) {
        if (result == null || !result.isFound() || result.getReceivedTime() == null) {
            return false;
        }

        long recentThreshold = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(Math.max(1, codeRecentMinutes));
        return result.getReceivedTime().getTime() >= recentThreshold;
    }

    private HotmailCodeResult buildEmptyResult(HotmailAccount account) {
        HotmailCodeResult result = new HotmailCodeResult();
        result.setAccountId(account.getId());
        result.setEmail(account.getEmail());
        result.setFound(false);
        return result;
    }

    private String getResponseErrorText(RestClientResponseException e) {
        String body = e.getResponseBodyAsString(StandardCharsets.UTF_8);
        if (body == null || body.isBlank()) {
            return e.getMessage();
        }

        try {
            JsonNode jsonNode = objectMapper.readTree(body);
            if (jsonNode.hasNonNull("error_description")) {
                return preserveServiceAbuseMode(body, jsonNode.get("error_description").asText());
            }
            if (jsonNode.hasNonNull("message")) {
                return preserveServiceAbuseMode(body, jsonNode.get("message").asText());
            }
            JsonNode error = jsonNode.path("error");
            if (error.isTextual()) {
                return preserveServiceAbuseMode(body, error.asText());
            }
            if (error.hasNonNull("message")) {
                return preserveServiceAbuseMode(body, error.get("message").asText());
            }
        } catch (Exception ignored) {
        }

        return body;
    }

    private String preserveServiceAbuseMode(String responseBody, String extractedMessage) {
        if (responseBody.toLowerCase(Locale.ROOT).contains("service_abuse_mode")
                && !extractedMessage.toLowerCase(Locale.ROOT).contains("service_abuse_mode")) {
            return "service_abuse_mode: " + extractedMessage;
        }
        return extractedMessage;
    }

    private String cleanErrorMessage(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            message = e.getClass().getSimpleName();
        }
        String cleaned = message.replaceAll("\\s+", " ").trim();
        String lowerCleaned = cleaned.toLowerCase(Locale.ROOT);
        if (lowerCleaned.contains("service_abuse_mode")) {
            return "微软风控（service_abuse_mode），请停止重试或清除该邮箱";
        }
        if (lowerCleaned.contains("aadsts70000")
                || lowerCleaned.contains("scopes requested are unauthorized or expired")
                || lowerCleaned.contains("invalid_grant")) {
            return "邮箱授权缺少取信权限或 refresh_token 已失效，请重新生成包含 Mail.Read、IMAP.AccessAsUser.All、offline_access 的 refresh_token 后导入";
        }
        return cleaned.length() > 500 ? cleaned.substring(0, 500) + "..." : cleaned;
    }

    private boolean containsVerificationKeyword(String text) {
        String lowerText = text.toLowerCase(Locale.ROOT);
        return lowerText.contains("\u9a8c\u8bc1\u7801")
                || lowerText.contains("\u6821\u9a8c\u7801")
                || lowerText.contains("\u786e\u8ba4\u7801")
                || lowerText.contains("code")
                || lowerText.contains("verification")
                || lowerText.contains("verify")
                || lowerText.contains("validate")
                || lowerText.contains("security code")
                || lowerText.contains("one-time")
                || lowerText.contains("passcode")
                || lowerText.contains("authentication")
                || lowerText.contains("two-factor")
                || lowerText.contains("sign in")
                || lowerText.contains("signin")
                || lowerText.contains("login")
                || lowerText.contains("otp")
                || lowerText.contains("pin");
    }

    private Date parseGraphDate(String dateTimeText) {
        if (dateTimeText == null || dateTimeText.isBlank()) {
            return null;
        }

        try {
            return Date.from(Instant.parse(dateTimeText));
        } catch (Exception e) {
            return null;
        }
    }

    private HotmailCodeResult buildFailureResult(HotmailAccount account, String error) {
        HotmailCodeResult failResult = new HotmailCodeResult();
        failResult.setAccountId(account.getId());
        failResult.setEmail(account.getEmail());
        failResult.setFound(false);
        failResult.setSource("error");
        failResult.setError(error);
        failResult.setFetchTime(new Date());
        return failResult;
    }

    private boolean isValidEmail(String email) {
        return email != null && EMAIL_PATTERN.matcher(email).matches();
    }

    private HotmailAccountDto toDto(HotmailAccount account) {
        HotmailAccountDto dto = new HotmailAccountDto();
        dto.setId(account.getId());
        dto.setEmail(account.getEmail());
        dto.setGroupName(account.getGroupName());
        dto.setSubEmails(account.getSubEmails());
        dto.setGptRegistered(Boolean.TRUE.equals(account.getGptRegistered()));
        dto.setGptRegisteredSubEmails(account.getGptRegisteredSubEmails());
        dto.setGrokRegistered(Boolean.TRUE.equals(account.getGrokRegistered()));
        dto.setGrokRegisteredSubEmails(account.getGrokRegisteredSubEmails());
        dto.setPasswordSaved(account.getPassword() != null && !account.getPassword().isBlank());
        dto.setLastCode(account.getLastCode());
        dto.setLastCodeTime(account.getLastCodeTime());
        dto.setLastSubject(account.getLastSubject());
        dto.setLastSender(account.getLastSender());
        dto.setLastSource(account.getLastSource());
        dto.setLastFolder(account.getLastFolder());
        dto.setLastError(account.getLastError());
        dto.setLastFetchTime(account.getLastFetchTime());
        dto.setTokenCheckStatus(account.getTokenCheckStatus() == null ? TOKEN_CHECK_UNKNOWN : account.getTokenCheckStatus());
        dto.setGraphTokenOk(account.getGraphTokenOk());
        dto.setOutlookTokenOk(account.getOutlookTokenOk());
        dto.setImapTokenOk(account.getImapTokenOk());
        dto.setTokenCheckSummary(account.getTokenCheckSummary());
        dto.setTokenCheckedAt(account.getTokenCheckedAt());
        dto.setPublicCodeToken(account.getPublicCodeToken());
        dto.setPublicCodeUid(account.getPublicCodeUid());
        dto.setPublicCodeTargetEmail(account.getPublicCodeTargetEmail());
        dto.setPublicCodeEnabled(Boolean.TRUE.equals(account.getPublicCodeEnabled()));
        dto.setPublicCodeCreatedAt(account.getPublicCodeCreatedAt());
        dto.setPublicCodeLastAccessTime(account.getPublicCodeLastAccessTime());
        dto.setCreateTime(account.getCreateTime());
        return dto;
    }

    private void rememberRefreshToken(HotmailAccount account, TokenRefreshResult tokenRefreshResult) {
        if (tokenRefreshResult != null && tokenRefreshResult.refreshToken() != null && !tokenRefreshResult.refreshToken().isBlank()) {
            account.setRefreshToken(hotmailCredentialCrypto.encrypt(tokenRefreshResult.refreshToken()));
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private enum TokenCache {
        GRAPH,
        OUTLOOK_REST,
        IMAP
    }

    private record TokenRefreshResult(String accessToken, String refreshToken, Date expiresAt) {
    }

    private record MailboxFolder(String id, String displayName) {
    }

    private record ParsedHotmailAccount(String email, String password, String clientId, String refreshToken, String error) {
    }

    private static class PublicCodeRateLimitWindow {
        private long windowStartMillis;
        private long lastAccessMillis;
        private int count;

        private PublicCodeRateLimitWindow(long now) {
            this.windowStartMillis = now;
            this.lastAccessMillis = now;
        }
    }
}
