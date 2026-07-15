package com.idncar.api.download;

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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping
public class DownloadController {

    private static final String RESOURCE_IDENTIFIER_PREFIX = "download-resource:";

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.download-subdir:downloads}")
    private String uploadDownloadSubDir;

    @Autowired
    private DownloadService downloadService;

    @Autowired
    private DownloadResourceMapper downloadResourceMapper;

    @GetMapping("/api/downloads")
    public ResponseEntity<List<DownloadResourceDto>> getDownloads() {
        return ResponseEntity.ok(downloadService.getDownloads());
    }

    @PostMapping("/api/downloads/{id}/track")
    public ResponseEntity<Map<String, String>> trackDownload(@PathVariable Long id) {
        downloadService.trackDownload(id);
        return ResponseEntity.ok(Map.of("message", "下载次数记录成功"));
    }

    @GetMapping({"/api/download/captcha", "/api/download/captcha/", "/api/captcha", "/api/captcha/"})
    public ResponseEntity<DownloadCaptchaDto> getCaptcha() {
        return ResponseEntity.ok(downloadService.createCaptcha());
    }

    @PostMapping({"/api/download/verify", "/api/download/verify/", "/api/verify_captcha", "/api/verify_captcha/"})
    public ResponseEntity<VerifyDownloadCaptchaResponse> verifyCaptcha(@RequestBody VerifyDownloadCaptchaRequest request) {
        return ResponseEntity.ok(downloadService.verifyCaptcha(request));
    }

    @GetMapping({"/api/download/direct", "/api/download/direct/"})
    public ResponseEntity<?> directDownload(@RequestParam String resource, @RequestParam(required = false) String fileName) {
        String normalizedResource = normalizeDownloadUrl(resource);
        DownloadResource matchedResource = findDownloadResourceByUrl(resource, normalizedResource);
        if (matchedResource != null
                && (Boolean.TRUE.equals(matchedResource.getLocked()) || hasDownloadPassword(matchedResource))) {
            throw ApiException.forbidden("该资源需要先完成下载验证");
        }
        Path localUploadFile = resolveLocalUploadPath(normalizedResource);

        if (localUploadFile != null) {
            if (matchedResource == null) {
                throw ApiException.notFound("下载资源不存在");
            }
            if (!Files.exists(localUploadFile) || !Files.isRegularFile(localUploadFile)) {
                throw ApiException.notFound("下载文件不存在");
            }
            return buildAttachmentResponse(localUploadFile, normalizeDownloadFileName(fileName, localUploadFile));
        }

        if (matchedResource == null) {
            throw ApiException.notFound("下载资源不存在");
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(normalizedResource)).build();
    }

    @GetMapping({"/api/download", "/api/download/"})
    public ResponseEntity<?> downloadByToken(@RequestParam String token) {
        DownloadTargetDto target = downloadService.consumeDownloadToken(token);
        DownloadResource matchedResource = findDownloadResourceByUrl(target.url(), normalizeDownloadUrl(target.url()));
        if (matchedResource == null) {
            throw ApiException.notFound("下载资源不存在");
        }
        Path localUploadFile = resolveLocalUploadPath(target.url());

        if (localUploadFile != null) {
            if (!Files.exists(localUploadFile) || !Files.isRegularFile(localUploadFile)) {
                throw ApiException.notFound("下载文件不存在");
            }
            return buildAttachmentResponse(localUploadFile, target.fileName());
        }

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(target.url())).build();
    }

    private DownloadResource findDownloadResourceByUrl(String originalUrl, String normalizedUrl) {
        Long resourceId = parseResourceIdentifier(originalUrl);
        if (resourceId != null) {
            return downloadResourceMapper.selectById(resourceId);
        }
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

    private boolean hasDownloadPassword(DownloadResource resource) {
        return resource != null
                && resource.getDownloadPasswordHash() != null
                && !resource.getDownloadPasswordHash().isBlank();
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

    private String extractLocalUploadRelativePath(String url) {
        String path = extractPath(url);
        if (path == null) {
            return null;
        }
        String relativePath = null;
        if (path.startsWith("/api/uploads/")) {
            relativePath = path.substring("/api/uploads/".length());
        } else if (path.startsWith("/uploads/")) {
            relativePath = path.substring("/uploads/".length());
        }
        return normalizeDownloadRelativePath(relativePath);
    }

    private Path resolveLocalUploadPath(String downloadUrl) {
        String relativePath = extractLocalUploadRelativePath(downloadUrl);
        if (relativePath == null) {
            return null;
        }

        Path uploadRoot = Paths.get(uploadBaseDir).toAbsolutePath().normalize();
        Path resolved = uploadRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw ApiException.badRequest("下载路径不合法");
        }
        return resolved;
    }

    private String normalizeDownloadRelativePath(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return null;
        }
        String normalized = relativePath.trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }

        String downloadSubDir = normalizePathSegment(uploadDownloadSubDir);
        if (!normalized.startsWith(downloadSubDir + "/")) {
            return null;
        }
        return normalized;
    }

    private String normalizePathSegment(String value) {
        String normalized = value == null ? "" : value.trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.isBlank() || normalized.contains("/") || normalized.equals(".") || normalized.equals("..")) {
            throw new IllegalStateException("下载文件目录配置无效: " + value);
        }
        return normalized;
    }

    private String extractPath(String downloadUrl) {
        if (downloadUrl == null || downloadUrl.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(downloadUrl);
            String path = uri.getPath();
            if (path == null || path.isBlank()) {
                return null;
            }
            return path;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalizeDownloadUrl(String resource) {
        if (resource == null || resource.isBlank()) {
            throw ApiException.badRequest("下载资源不能为空");
        }

        String normalized = resource.trim();
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

    private String normalizeDownloadFileName(String fileName, Path filePath) {
        String normalized = fileName == null ? "" : fileName.trim();
        normalized = normalized
                .replace("\\", "_")
                .replace("/", "_")
                .replace(":", "_")
                .replace("*", "_")
                .replace("?", "_")
                .replace("\"", "_")
                .replace("<", "_")
                .replace(">", "_")
                .replace("|", "_");

        if (normalized.isBlank()) {
            return filePath.getFileName().toString();
        }

        String storedFileName = filePath.getFileName().toString();
        int dotIndex = storedFileName.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < storedFileName.length() - 1 && normalized.lastIndexOf('.') < 0) {
            normalized = normalized + storedFileName.substring(dotIndex);
        }

        return normalized;
    }

    private ResponseEntity<Resource> buildAttachmentResponse(Path filePath, String fileName) {
        String downloadFileName = fileName;
        if (downloadFileName == null || downloadFileName.isBlank()) {
            downloadFileName = filePath.getFileName().toString();
        }

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        try {
            String contentType = Files.probeContentType(filePath);
            if (contentType != null && !contentType.isBlank()) {
                mediaType = MediaType.parseMediaType(contentType);
            }
        } catch (Exception ignored) {
            // Ignore and fallback to octet-stream.
        }

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(downloadFileName, StandardCharsets.UTF_8)
                .build();

        FileSystemResource resource = new FileSystemResource(filePath.toFile());
        long contentLength = -1L;
        try {
            contentLength = Files.size(filePath);
        } catch (IOException ignored) {
            // Keep unknown length.
        }

        ResponseEntity.BodyBuilder responseBuilder = ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString());

        if (contentLength >= 0) {
            responseBuilder.contentLength(contentLength);
        }

        return responseBuilder.body(resource);
    }
}
