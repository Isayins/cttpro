package com.idncar.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class UploadConfig implements WebMvcConfigurer {

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.avatar-subdir:avatars}")
    private String uploadAvatarSubDir;

    @Value("${app.upload.chat-image-subdir:chat-images}")
    private String uploadChatImageSubDir;

    @Value("${app.upload.forum-image-subdir:forum-images}")
    private String uploadForumImageSubDir;

    @Value("${app.upload.forum-board-avatar-subdir:forum-board-avatars}")
    private String uploadForumBoardAvatarSubDir;

    @Value("${app.upload.product-image-subdir:product-images}")
    private String uploadProductImageSubDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadDir = Paths.get(uploadBaseDir).toAbsolutePath().normalize();
        String avatarSubDir = normalizePathSegment(uploadAvatarSubDir);
        String chatImageSubDir = normalizePathSegment(uploadChatImageSubDir);
        String forumImageSubDir = normalizePathSegment(uploadForumImageSubDir);
        String forumBoardAvatarSubDir = normalizePathSegment(uploadForumBoardAvatarSubDir);
        String productImageSubDir = normalizePathSegment(uploadProductImageSubDir);
        Path avatarDir = ensureUploadDirectory(uploadDir, avatarSubDir);
        Path chatImageDir = ensureUploadDirectory(uploadDir, chatImageSubDir);
        Path forumImageDir = ensureUploadDirectory(uploadDir, forumImageSubDir);
        Path forumBoardAvatarDir = ensureUploadDirectory(uploadDir, forumBoardAvatarSubDir);
        Path productImageDir = ensureUploadDirectory(uploadDir, productImageSubDir);

        registry.addResourceHandler("/uploads/" + avatarSubDir + "/**", "/api/uploads/" + avatarSubDir + "/**")
                .addResourceLocations(avatarDir.toUri().toString());
        registry.addResourceHandler("/uploads/" + chatImageSubDir + "/**", "/api/uploads/" + chatImageSubDir + "/**")
                .addResourceLocations(chatImageDir.toUri().toString());
        registry.addResourceHandler("/uploads/" + forumImageSubDir + "/**", "/api/uploads/" + forumImageSubDir + "/**")
                .addResourceLocations(forumImageDir.toUri().toString());
        registry.addResourceHandler("/uploads/" + forumBoardAvatarSubDir + "/**", "/api/uploads/" + forumBoardAvatarSubDir + "/**")
                .addResourceLocations(forumBoardAvatarDir.toUri().toString());
        registry.addResourceHandler("/uploads/" + productImageSubDir + "/**", "/api/uploads/" + productImageSubDir + "/**")
                .addResourceLocations(productImageDir.toUri().toString());
    }

    private Path ensureUploadDirectory(Path uploadDir, String subDir) {
        Path targetDir = uploadDir.resolve(subDir).normalize();
        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to create upload directory: " + targetDir, e);
        }
        return targetDir;
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
            throw new IllegalStateException("Invalid avatar upload subdir: " + value);
        }
        return normalized;
    }
}
