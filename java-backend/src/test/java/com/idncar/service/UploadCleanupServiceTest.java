package com.idncar.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UploadCleanupServiceTest {

    @TempDir
    Path uploadRoot;

    @Test
    void cleanupDeletesOnlyExpiredUnreferencedImages() throws Exception {
        Path chatImages = Files.createDirectories(uploadRoot.resolve("chat-images"));
        Path referenced = Files.writeString(chatImages.resolve("referenced.png"), "kept");
        Path orphaned = Files.writeString(chatImages.resolve("orphaned.png"), "deleted");
        FileTime expired = FileTime.from(Instant.now().minus(8, ChronoUnit.DAYS));
        Files.setLastModifiedTime(referenced, expired);
        Files.setLastModifiedTime(orphaned, expired);

        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            return sql.contains("private_chat_messages")
                    ? List.of("![图片](/api/uploads/chat-images/referenced.png)")
                    : List.of();
        });

        UploadCleanupService service = new UploadCleanupService();
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbcTemplate);
        ReflectionTestUtils.setField(service, "uploadBaseDir", uploadRoot.toString());
        ReflectionTestUtils.setField(service, "avatarSubDir", "avatars");
        ReflectionTestUtils.setField(service, "chatImageSubDir", "chat-images");
        ReflectionTestUtils.setField(service, "forumImageSubDir", "forum-images");
        ReflectionTestUtils.setField(service, "forumBoardAvatarSubDir", "forum-board-avatars");
        ReflectionTestUtils.setField(service, "productImageSubDir", "product-images");

        service.deleteOrphanedImages();

        assertThat(referenced).exists();
        assertThat(orphaned).doesNotExist();
    }
}
