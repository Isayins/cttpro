package com.idncar.service;

import com.idncar.util.ImageUploadHelper;
import com.idncar.util.RichContentValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class UploadCleanupService {

    private static final Logger LOGGER = LoggerFactory.getLogger(UploadCleanupService.class);
    private static final int ORPHAN_RETENTION_DAYS = 7;

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.avatar-subdir:avatars}")
    private String avatarSubDir;

    @Value("${app.upload.chat-image-subdir:chat-images}")
    private String chatImageSubDir;

    @Value("${app.upload.forum-image-subdir:forum-images}")
    private String forumImageSubDir;

    @Value("${app.upload.forum-board-avatar-subdir:forum-board-avatars}")
    private String forumBoardAvatarSubDir;

    @Value("${app.upload.product-image-subdir:product-images}")
    private String productImageSubDir;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Scheduled(initialDelay = 300_000L, fixedDelay = 86_400_000L)
    public void deleteOrphanedImages() {
        cleanupDirectory(avatarSubDir, "头像", directReferences(
                "SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL", avatarSubDir, "头像"));
        cleanupDirectory(productImageSubDir, "商品", directReferences(
                "SELECT image_url FROM products WHERE image_url IS NOT NULL", productImageSubDir, "商品"));
        cleanupDirectory(forumBoardAvatarSubDir, "吧头像", directReferences(
                "SELECT avatar_url FROM forum_boards WHERE avatar_url IS NOT NULL", forumBoardAvatarSubDir, "吧头像"));
        cleanupDirectory(forumImageSubDir, "论坛", richContentReferences(
                "SELECT content FROM posts WHERE content IS NOT NULL UNION ALL SELECT content FROM replies WHERE content IS NOT NULL",
                forumImageSubDir,
                "论坛"));
        cleanupDirectory(chatImageSubDir, "聊天", richContentReferences(
                "SELECT content FROM community_chat_messages WHERE content IS NOT NULL "
                        + "UNION ALL SELECT content FROM private_chat_messages WHERE content IS NOT NULL",
                chatImageSubDir,
                "聊天"));
    }

    private Set<String> directReferences(String sql, String subDir, String featureName) {
        Set<String> references = new HashSet<>();
        for (String url : jdbcTemplate.queryForList(sql, String.class)) {
            addReference(references, url, subDir, featureName);
        }
        return references;
    }

    private Set<String> richContentReferences(String sql, String subDir, String featureName) {
        Set<String> references = new HashSet<>();
        for (String content : jdbcTemplate.queryForList(sql, String.class)) {
            for (String url : RichContentValidator.extractImageMarkupUrls(content)) {
                addReference(references, url, subDir, featureName);
            }
        }
        return references;
    }

    private void addReference(Set<String> references, String url, String subDir, String featureName) {
        String fileName = ImageUploadHelper.extractLocalImageFileName(url, subDir, featureName);
        if (fileName != null) {
            references.add(fileName);
        }
    }

    private void cleanupDirectory(String subDir, String featureName, Set<String> references) {
        Path uploadDir = ImageUploadHelper.resolveUploadDir(uploadBaseDir, subDir, featureName);
        if (!Files.isDirectory(uploadDir)) {
            return;
        }
        Instant cutoff = Instant.now().minus(ORPHAN_RETENTION_DAYS, ChronoUnit.DAYS);
        try (Stream<Path> files = Files.list(uploadDir)) {
            for (Path file : files.filter(Files::isRegularFile).toList()) {
                String fileName = file.getFileName().toString();
                FileTime modifiedAt = Files.getLastModifiedTime(file);
                if (!references.contains(fileName) && modifiedAt.toInstant().isBefore(cutoff)) {
                    Files.deleteIfExists(file);
                }
            }
        } catch (IOException exception) {
            LOGGER.warn("Failed to clean orphaned {} images in {}", featureName, uploadDir, exception);
        }
    }
}
