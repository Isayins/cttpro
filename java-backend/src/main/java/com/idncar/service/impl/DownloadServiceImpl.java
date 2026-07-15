package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.DownloadResourceMapper;
import com.idncar.model.dto.DownloadCaptchaDto;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.DownloadTargetDto;
import com.idncar.model.dto.VerifyDownloadCaptchaRequest;
import com.idncar.model.dto.VerifyDownloadCaptchaResponse;
import com.idncar.model.entity.DownloadResource;
import com.idncar.service.DownloadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class DownloadServiceImpl implements DownloadService {

    private static final long CAPTCHA_TTL_MINUTES = 5L;
    private static final long DOWNLOAD_TOKEN_TTL_MINUTES = 10L;
    private static final String TOKEN_VALUE_SEPARATOR = "||__FILENAME__||";
    private static final String RESOURCE_IDENTIFIER_PREFIX = "download-resource:";

    private final Map<String, LocalCacheEntry> localCaptchaStore = new ConcurrentHashMap<>();
    private final Map<String, LocalCacheEntry> localTokenStore = new ConcurrentHashMap<>();
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Autowired
    private DownloadResourceMapper downloadResourceMapper;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Override
    public List<DownloadResourceDto> getDownloads() {
        return downloadResourceMapper.selectList(
                        new QueryWrapper<DownloadResource>()
                                .orderByAsc("sort_order")
                                .orderByDesc("create_time")
                ).stream()
                .map(DownloadResourceDto::fromPublicEntity)
                .collect(Collectors.toList());
    }

    @Override
    public void trackDownload(Long downloadId) {
        DownloadResource resource = downloadResourceMapper.selectById(downloadId);
        if (resource == null) {
            throw ApiException.notFound("下载资源不存在");
        }
        downloadResourceMapper.incrementDownloadCount(downloadId);
    }

    @Override
    public DownloadCaptchaDto createCaptcha() {
        String captchaId = UUID.randomUUID().toString();
        String answer = String.valueOf(1000 + ThreadLocalRandom.current().nextInt(9000));

        storeWithFallback(captchaKey(captchaId), answer, CAPTCHA_TTL_MINUTES, localCaptchaStore, captchaId);

        return new DownloadCaptchaDto(captchaId, buildCaptchaImage(answer));
    }

    @Override
    public VerifyDownloadCaptchaResponse verifyCaptcha(VerifyDownloadCaptchaRequest request) {
        if (request == null) {
            throw ApiException.badRequest("缺少下载验证参数");
        }
        String resource = requireText(request.resource(), "下载资源不能为空");

        DownloadResource matchedResource = findDownloadResource(resource);
        if (matchedResource == null) {
            throw ApiException.notFound("下载资源不存在");
        }
        String normalizedResourceUrl = normalizeDownloadUrl(matchedResource.getUrl());

        String captchaId = null;
        if (Boolean.TRUE.equals(matchedResource.getLocked())) {
            captchaId = requireText(request.captchaId(), "验证码编号不能为空");
            String answer = requireText(request.answer(), "验证码答案不能为空");
            String cachedAnswer = readWithFallback(captchaKey(captchaId), localCaptchaStore, captchaId);
            deleteStoredValue(captchaKey(captchaId), localCaptchaStore, captchaId);
            if (cachedAnswer == null || !answer.equalsIgnoreCase(cachedAnswer)) {
                return new VerifyDownloadCaptchaResponse(false, null, "验证码错误或已过期");
            }
        }

        if (hasDownloadPassword(matchedResource)) {
            String password = normalizeNullableText(request.password());
            if (password == null || !passwordEncoder.matches(password, matchedResource.getDownloadPasswordHash())) {
                return new VerifyDownloadCaptchaResponse(false, null, "下载密码错误");
            }
        }

        String resolvedFileName = resolveDownloadFileName(request.fileName(), matchedResource, normalizedResourceUrl);

        String downloadToken = UUID.randomUUID().toString();
        storeWithFallback(
                downloadTokenKey(downloadToken),
                packTokenValue(normalizedResourceUrl, resolvedFileName),
                DOWNLOAD_TOKEN_TTL_MINUTES,
                localTokenStore,
                downloadToken
        );

        return new VerifyDownloadCaptchaResponse(true, downloadToken, "下载验证通过");
    }

    @Override
    public DownloadTargetDto consumeDownloadToken(String token) {
        String normalizedToken = requireText(token, "下载令牌不能为空");
        String tokenValue = consumeWithFallback(downloadTokenKey(normalizedToken), localTokenStore, normalizedToken);
        if (tokenValue == null) {
            throw ApiException.badRequest("下载令牌无效或已过期");
        }
        return unpackTokenValue(tokenValue);
    }

    private String buildCaptchaImage(String answer) {
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
                    <rect width="220" height="80" rx="12" fill="#f8fafc"/>
                    <path d="M16 58 C44 18, 78 76, 112 30 S170 8, 204 54" fill="none" stroke="#dbeafe" stroke-width="6"/>
                    <text x="26" y="53" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#1e3a8a" letter-spacing="8">%s</text>
                </svg>
                """.formatted(answer);

        return "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(svg.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeDownloadUrl(String resource) {
        String normalized = requireText(resource, "下载资源不能为空");
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return normalized;
        }
        if (normalized.startsWith("/uploads/")) {
            return "/api" + normalized;
        }
        if (normalized.startsWith("/")) {
            return normalized;
        }
        if (normalized.startsWith("uploads/")) {
            return "/api/" + normalized;
        }
        return "/" + normalized;
    }

    private DownloadResource findDownloadResourceByUrl(String originalUrl, String normalizedUrl) {
        Set<String> candidates = new LinkedHashSet<>();
        addCandidate(candidates, originalUrl);
        addCandidate(candidates, normalizedUrl);
        addCandidate(candidates, alternateUploadUrl(originalUrl));
        addCandidate(candidates, alternateUploadUrl(normalizedUrl));

        if (candidates.isEmpty()) {
            return null;
        }

        QueryWrapper<DownloadResource> query = new QueryWrapper<>();
        query.in("url", new ArrayList<>(candidates)).last("LIMIT 1");
        DownloadResource exactMatch = downloadResourceMapper.selectOne(query);
        if (exactMatch != null) {
            return exactMatch;
        }

        String uploadRelativePath = extractLocalUploadRelativePath(normalizedUrl);
        if (uploadRelativePath == null) {
            uploadRelativePath = extractLocalUploadRelativePath(originalUrl);
        }
        if (uploadRelativePath == null) {
            return null;
        }

        String matchedUploadRelativePath = uploadRelativePath;
        return downloadResourceMapper.selectList(new QueryWrapper<DownloadResource>())
                .stream()
                .filter(resource -> matchedUploadRelativePath.equals(extractLocalUploadRelativePath(resource.getUrl())))
                .findFirst()
                .orElse(null);
    }

    private DownloadResource findDownloadResource(String resource) {
        Long resourceId = parseResourceIdentifier(resource);
        if (resourceId != null) {
            return downloadResourceMapper.selectById(resourceId);
        }
        String normalizedUrl = normalizeDownloadUrl(resource);
        return findDownloadResourceByUrl(resource, normalizedUrl);
    }

    private Long parseResourceIdentifier(String resource) {
        if (resource == null || !resource.startsWith(RESOURCE_IDENTIFIER_PREFIX)) {
            return null;
        }
        try {
            long id = Long.parseLong(resource.substring(RESOURCE_IDENTIFIER_PREFIX.length()));
            return id > 0 ? id : null;
        } catch (NumberFormatException ignored) {
            throw ApiException.badRequest("下载资源标识不正确");
        }
    }

    private void addCandidate(Set<String> candidates, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        candidates.add(value);
    }

    private String alternateUploadUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        if (url.startsWith("/api/uploads/")) {
            return "/uploads/" + url.substring("/api/uploads/".length());
        }
        if (url.startsWith("/uploads/")) {
            return "/api" + url;
        }
        return null;
    }

    private String extractPath(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            String path = URI.create(url).getPath();
            return path == null || path.isBlank() ? null : path;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String extractLocalUploadRelativePath(String url) {
        String path = extractPath(url);
        if (path == null) {
            return null;
        }
        if (path.startsWith("/api/uploads/")) {
            return path.substring("/api/uploads/".length());
        }
        if (path.startsWith("/uploads/")) {
            return path.substring("/uploads/".length());
        }
        return null;
    }

    private String resolveDownloadFileName(String requestedFileName, DownloadResource resource, String downloadUrl) {
        String fromRequest = sanitizeDownloadFileName(requestedFileName);
        if (fromRequest != null) {
            return ensureExtension(fromRequest, downloadUrl);
        }

        if (resource != null) {
            String fromTitle = sanitizeDownloadFileName(resource.getTitle());
            if (fromTitle != null) {
                return ensureExtension(fromTitle, downloadUrl);
            }
        }

        String fromUrl = sanitizeDownloadFileName(extractFileNameFromUrl(downloadUrl));
        if (fromUrl != null) {
            return fromUrl;
        }

        return "download.bin";
    }

    private String ensureExtension(String fileName, String downloadUrl) {
        String extension = extractExtensionFromUrl(downloadUrl);
        if (extension == null || extension.isBlank()) {
            return fileName;
        }

        if (fileName.toLowerCase().endsWith(extension.toLowerCase())) {
            return fileName;
        }
        return fileName + extension;
    }

    private String extractExtensionFromUrl(String downloadUrl) {
        String fromUrl = extractFileNameFromUrl(downloadUrl);
        if (fromUrl == null || fromUrl.isBlank()) {
            return null;
        }
        int dotIndex = fromUrl.lastIndexOf('.');
        if (dotIndex <= 0 || dotIndex >= fromUrl.length() - 1) {
            return null;
        }
        String extension = fromUrl.substring(dotIndex);
        if (extension.length() > 20) {
            return null;
        }
        return extension;
    }

    private String extractFileNameFromUrl(String downloadUrl) {
        if (downloadUrl == null || downloadUrl.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(downloadUrl);
            String path = uri.getPath();
            if (path == null || path.isBlank()) {
                return null;
            }
            int index = path.lastIndexOf('/');
            String rawName = index >= 0 ? path.substring(index + 1) : path;
            if (rawName.isBlank()) {
                return null;
            }
            return URLDecoder.decode(rawName, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String sanitizeDownloadFileName(String value) {
        if (value == null) {
            return null;
        }
        String sanitized = value.trim()
                .replace("\\", "_")
                .replace("/", "_")
                .replace(":", "_")
                .replace("*", "_")
                .replace("?", "_")
                .replace("\"", "_")
                .replace("<", "_")
                .replace(">", "_")
                .replace("|", "_")
                .replace("\r", "")
                .replace("\n", "")
                .replace("\t", " ");
        while (sanitized.contains("  ")) {
            sanitized = sanitized.replace("  ", " ");
        }
        if (sanitized.length() > 180) {
            sanitized = sanitized.substring(0, 180);
        }
        while (sanitized.endsWith(".")) {
            sanitized = sanitized.substring(0, sanitized.length() - 1);
        }
        sanitized = sanitized.trim();
        return sanitized.isEmpty() ? null : sanitized;
    }

    private String packTokenValue(String downloadUrl, String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return downloadUrl;
        }
        return downloadUrl + TOKEN_VALUE_SEPARATOR + fileName;
    }

    private DownloadTargetDto unpackTokenValue(String tokenValue) {
        int splitIndex = tokenValue.indexOf(TOKEN_VALUE_SEPARATOR);
        if (splitIndex < 0) {
            String fallbackFileName = resolveDownloadFileName(null, null, tokenValue);
            return new DownloadTargetDto(tokenValue, fallbackFileName);
        }

        String url = tokenValue.substring(0, splitIndex);
        String fileName = tokenValue.substring(splitIndex + TOKEN_VALUE_SEPARATOR.length());
        String sanitized = sanitizeDownloadFileName(fileName);
        if (sanitized == null) {
            sanitized = resolveDownloadFileName(null, null, url);
        }
        return new DownloadTargetDto(url, sanitized);
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw ApiException.badRequest(message);
        }
        return value.trim();
    }

    private String normalizeNullableText(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private boolean hasDownloadPassword(DownloadResource resource) {
        return resource != null
                && resource.getDownloadPasswordHash() != null
                && !resource.getDownloadPasswordHash().isBlank();
    }

    private String captchaKey(String captchaId) {
        return "download:captcha:" + captchaId;
    }

    private String downloadTokenKey(String token) {
        return "download:token:" + token;
    }

    private void storeWithFallback(String redisKey, String value, long ttlMinutes, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        fallbackStore.put(fallbackKey,
                new LocalCacheEntry(value, System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(ttlMinutes)));
        try {
            redisTemplate.opsForValue().set(redisKey, value, ttlMinutes, TimeUnit.MINUTES);
        } catch (Exception ignored) {
            // The in-memory copy above keeps verification available while Redis is unavailable.
        }
    }

    private String readWithFallback(String redisKey, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        try {
            Object redisValue = redisTemplate.opsForValue().get(redisKey);
            if (redisValue != null) {
                return String.valueOf(redisValue);
            }
        } catch (Exception ignored) {
            // Read the local backup below.
        }

        LocalCacheEntry entry = fallbackStore.get(fallbackKey);
        if (entry == null) {
            return null;
        }
        if (entry.expireAtMillis() < System.currentTimeMillis()) {
            fallbackStore.remove(fallbackKey, entry);
            return null;
        }
        return entry.value();
    }

    private void deleteStoredValue(String redisKey, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        fallbackStore.remove(fallbackKey);
        try {
            redisTemplate.delete(redisKey);
        } catch (Exception ignored) {
            // The local copy has already been removed.
        }
    }

    private String consumeWithFallback(String redisKey, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        String value = null;
        try {
            Object redisValue = redisTemplate.opsForValue().get(redisKey);
            redisTemplate.delete(redisKey);
            if (redisValue != null) {
                value = String.valueOf(redisValue);
            }
        } catch (Exception ignored) {
            // Redis unavailable, fallback to in-memory temporary store.
        }

        LocalCacheEntry entry = fallbackStore.remove(fallbackKey);
        if (value != null) {
            return value;
        }
        if (entry == null || entry.expireAtMillis() < System.currentTimeMillis()) {
            return null;
        }
        return entry.value();
    }

    private record LocalCacheEntry(String value, long expireAtMillis) {
    }
}
