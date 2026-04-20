package com.idncar.api.download;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.DownloadCaptchaDto;
import com.idncar.model.dto.DownloadResourceDto;
import com.idncar.model.dto.DownloadTargetDto;
import com.idncar.model.dto.VerifyDownloadCaptchaRequest;
import com.idncar.model.dto.VerifyDownloadCaptchaResponse;
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
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class DownloadController {

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Autowired
    private DownloadService downloadService;

    @GetMapping("/api/downloads")
    public ResponseEntity<List<DownloadResourceDto>> getDownloads() {
        return ResponseEntity.ok(downloadService.getDownloads());
    }

    @PostMapping("/api/downloads/{id}/track")
    public ResponseEntity<Map<String, String>> trackDownload(@PathVariable Long id) {
        downloadService.trackDownload(id);
        return ResponseEntity.ok(Map.of("message", "Download count tracked"));
    }

    @GetMapping({"/api/captcha", "/api/captcha/"})
    public ResponseEntity<DownloadCaptchaDto> getCaptcha() {
        return ResponseEntity.ok(downloadService.createCaptcha());
    }

    @PostMapping({"/api/verify_captcha", "/api/verify_captcha/"})
    public ResponseEntity<VerifyDownloadCaptchaResponse> verifyCaptcha(@RequestBody VerifyDownloadCaptchaRequest request) {
        return ResponseEntity.ok(downloadService.verifyCaptcha(request));
    }

    @GetMapping({"/api/download", "/api/download/"})
    public ResponseEntity<?> downloadByToken(@RequestParam String token) {
        DownloadTargetDto target = downloadService.consumeDownloadToken(token);
        Path localUploadFile = resolveLocalUploadPath(target.url());

        if (localUploadFile != null) {
            if (!Files.exists(localUploadFile) || !Files.isRegularFile(localUploadFile)) {
                throw ApiException.notFound("Download file not found");
            }
            return buildAttachmentResponse(localUploadFile, target.fileName());
        }

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(target.url())).build();
    }

    private Path resolveLocalUploadPath(String downloadUrl) {
        String path = extractPath(downloadUrl);
        if (path == null) {
            return null;
        }

        String relativePath;
        if (path.startsWith("/api/uploads/")) {
            relativePath = path.substring("/api/uploads/".length());
        } else if (path.startsWith("/uploads/")) {
            relativePath = path.substring("/uploads/".length());
        } else {
            return null;
        }

        Path uploadRoot = Paths.get(uploadBaseDir).toAbsolutePath().normalize();
        Path resolved = uploadRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw ApiException.badRequest("Illegal download path");
        }
        return resolved;
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
