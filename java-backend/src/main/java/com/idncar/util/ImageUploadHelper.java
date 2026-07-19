package com.idncar.util;

import com.idncar.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

public final class ImageUploadHelper {

    private static final Logger LOGGER = LoggerFactory.getLogger(ImageUploadHelper.class);
    private static final long DEFAULT_MAX_IMAGE_SIZE_BYTES = 8L * 1024 * 1024;

    private ImageUploadHelper() {
    }

    public static Map<String, String> saveImage(MultipartFile file,
                                                Long userId,
                                                String uploadBaseDir,
                                                String uploadSubDir,
                                                String fileNamePrefix,
                                                String featureName) {
        return saveImage(file, userId, uploadBaseDir, uploadSubDir, fileNamePrefix, featureName, DEFAULT_MAX_IMAGE_SIZE_BYTES);
    }

    public static Map<String, String> saveImage(MultipartFile file,
                                                Long userId,
                                                String uploadBaseDir,
                                                String uploadSubDir,
                                                String fileNamePrefix,
                                                String featureName,
                                                long maxImageSizeBytes) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的图片");
        }
        if (file.getSize() > maxImageSizeBytes) {
            throw ApiException.badRequest(featureName + "图片不能超过 " + formatMaxSize(maxImageSizeBytes));
        }

        byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "读取" + featureName + "图片失败");
        }

        String extension = detectImageExtension(imageBytes);
        if (extension == null) {
            throw ApiException.badRequest("仅支持 JPG、PNG、WEBP、GIF 图片");
        }

        String imageSubDir = normalizePathSegment(uploadSubDir, featureName);
        Path uploadDir = resolveUploadDir(uploadBaseDir, uploadSubDir, featureName);
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "创建" + featureName + "图片目录失败");
        }

        String fileName = fileNamePrefix + "-" + userId + "-" + UUID.randomUUID().toString().replace("-", "") + extension;
        Path targetPath = uploadDir.resolve(fileName).normalize();
        if (!targetPath.startsWith(uploadDir)) {
            throw ApiException.badRequest("非法文件名");
        }

        try {
            Files.write(targetPath, imageBytes);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "保存" + featureName + "图片失败");
        }

        return Map.of(
                "url", "/api/uploads/" + imageSubDir + "/" + fileName,
                "originalFileName", file.getOriginalFilename() == null ? fileName : file.getOriginalFilename()
        );
    }

    public static Path resolveUploadDir(String uploadBaseDir, String uploadSubDir, String featureName) {
        String imageSubDir = normalizePathSegment(uploadSubDir, featureName);
        return Paths.get(uploadBaseDir).toAbsolutePath().normalize().resolve(imageSubDir).normalize();
    }

    public static void deleteLocalImageAfterCommit(String imageUrl,
                                                   String uploadBaseDir,
                                                   String uploadSubDir,
                                                   String featureName) {
        Path targetPath = resolveLocalImage(imageUrl, uploadBaseDir, uploadSubDir, featureName);
        if (targetPath == null) {
            return;
        }
        Runnable delete = () -> {
            try {
                Files.deleteIfExists(targetPath);
            } catch (IOException exception) {
                LOGGER.warn("Failed to delete unused {} image: {}", featureName, targetPath, exception);
            }
        };
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    delete.run();
                }
            });
            return;
        }
        delete.run();
    }

    public static String extractLocalImageFileName(String imageUrl, String uploadSubDir, String featureName) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return null;
        }
        String path;
        try {
            path = new URI(imageUrl.trim()).getPath();
        } catch (URISyntaxException exception) {
            return null;
        }
        String imageSubDir = normalizePathSegment(uploadSubDir, featureName);
        String apiPrefix = "/api/uploads/" + imageSubDir + "/";
        String publicPrefix = "/uploads/" + imageSubDir + "/";
        String fileName = path != null && path.startsWith(apiPrefix)
                ? path.substring(apiPrefix.length())
                : path != null && path.startsWith(publicPrefix) ? path.substring(publicPrefix.length()) : null;
        return fileName == null || fileName.isBlank() || fileName.contains("/") || fileName.contains("\\")
                ? null
                : fileName;
    }

    private static Path resolveLocalImage(String imageUrl,
                                          String uploadBaseDir,
                                          String uploadSubDir,
                                          String featureName) {
        String fileName = extractLocalImageFileName(imageUrl, uploadSubDir, featureName);
        if (fileName == null) {
            return null;
        }
        Path uploadDir = resolveUploadDir(uploadBaseDir, uploadSubDir, featureName);
        Path targetPath = uploadDir.resolve(fileName).normalize();
        return targetPath.startsWith(uploadDir) ? targetPath : null;
    }

    public static String normalizePathSegment(String value, String featureName) {
        String normalized = value == null ? "" : value.trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.isBlank() || normalized.contains("/") || normalized.equals(".") || normalized.equals("..")) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, featureName + "图片目录配置无效");
        }
        return normalized;
    }

    private static String formatMaxSize(long maxSizeBytes) {
        long megabytes = maxSizeBytes / (1024 * 1024);
        if (megabytes > 0 && maxSizeBytes % (1024 * 1024) == 0) {
            return megabytes + "MB";
        }
        return maxSizeBytes + "B";
    }

    private static String detectImageExtension(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return ".jpg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return ".png";
        }
        if (bytes.length >= 6
                && bytes[0] == 0x47
                && bytes[1] == 0x49
                && bytes[2] == 0x46
                && bytes[3] == 0x38
                && (bytes[4] == 0x37 || bytes[4] == 0x39)
                && bytes[5] == 0x61) {
            return ".gif";
        }
        if (bytes.length >= 12
                && bytes[0] == 0x52
                && bytes[1] == 0x49
                && bytes[2] == 0x46
                && bytes[3] == 0x46
                && bytes[8] == 0x57
                && bytes[9] == 0x45
                && bytes[10] == 0x42
                && bytes[11] == 0x50) {
            return ".webp";
        }
        return null;
    }

}
