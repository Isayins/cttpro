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

    private final Map<String, LocalCacheEntry> localCaptchaStore = new ConcurrentHashMap<>();
    private final Map<String, LocalCacheEntry> localTokenStore = new ConcurrentHashMap<>();

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
                .map(DownloadResourceDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public void trackDownload(Long downloadId) {
        DownloadResource resource = downloadResourceMapper.selectById(downloadId);
        if (resource == null) {
            throw ApiException.notFound("涓嬭浇璧勬簮涓嶅瓨鍦?);
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
        String captchaId = requireText(request.captchaId(), "Captcha id is required");
        String answer = requireText(request.answer(), "Captcha answer is required");
        String resource = requireText(request.resource(), "Download resource is required");

        String cachedAnswer = consumeWithFallback(captchaKey(captchaId), localCaptchaStore, captchaId);
        if (cachedAnswer == null || !answer.equalsIgnoreCase(String.valueOf(cachedAnswer))) {
            return new VerifyDownloadCaptchaResponse(false, null, "楠岃瘉鐮侀敊璇?);
        }

        String normalizedResourceUrl = normalizeDownloadUrl(resource);
        DownloadResource matchedResource = findDownloadResourceByUrl(resource, normalizedResourceUrl);
        String resolvedFileName = resolveDownloadFileName(request.fileName(), matchedResource, normalizedResourceUrl);

        String downloadToken = UUID.randomUUID().toString();
        storeWithFallback(
                downloadTokenKey(downloadToken),
                packTokenValue(normalizedResourceUrl, resolvedFileName),
                DOWNLOAD_TOKEN_TTL_MINUTES,
                localTokenStore,
                downloadToken
        );

        return new VerifyDownloadCaptchaResponse(true, downloadToken, "楠岃瘉閫氳繃");
    }

    @Override
    public DownloadTargetDto consumeDownloadToken(String token) {
        String normalizedToken = requireText(token, "Download token is required");
        String tokenValue = consumeWithFallback(downloadTokenKey(normalizedToken), localTokenStore, normalizedToken);
        if (tokenValue == null) {
            throw ApiException.badRequest("涓嬭浇浠ょ墝鏃犳晥鎴栧凡杩囨湡");
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
        String normalized = requireText(resource, "Download resource is required");
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
        return downloadResourceMapper.selectOne(query);
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

    private String captchaKey(String captchaId) {
        return "download:captcha:" + captchaId;
    }

    private String downloadTokenKey(String token) {
        return "download:token:" + token;
    }

    private void storeWithFallback(String redisKey, String value, long ttlMinutes, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        try {
            redisTemplate.opsForValue().set(redisKey, value, ttlMinutes, TimeUnit.MINUTES);
        } catch (Exception ignored) {
            fallbackStore.put(fallbackKey, new LocalCacheEntry(value, System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(ttlMinutes)));
        }
    }

    private String consumeWithFallback(String redisKey, Map<String, LocalCacheEntry> fallbackStore, String fallbackKey) {
        try {
            Object redisValue = redisTemplate.opsForValue().get(redisKey);
            redisTemplate.delete(redisKey);
            if (redisValue != null) {
                return String.valueOf(redisValue);
            }
        } catch (Exception ignored) {
            // Redis unavailable, fallback to in-memory temporary store.
        }

        LocalCacheEntry entry = fallbackStore.remove(fallbackKey);
        if (entry == null || entry.expireAtMillis() < System.currentTimeMillis()) {
            return null;
        }
        return entry.value();
    }

    private record LocalCacheEntry(String value, long expireAtMillis) {
    }
}
