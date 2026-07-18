package com.idncar.api.admin;

import com.idncar.model.dto.AdminSystemHealthDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class AdminSystemHealthControllerTest {

    @TempDir
    Path tempDir;

    @Test
    void backupHealthReportsSuccessfulRemoteCopy() throws Exception {
        Path statusFile = tempDir.resolve("backup-status.properties");
        Files.writeString(statusFile, """
                status=SUCCESS
                finishedAt=%s
                backupDir=/tmp/backup
                remoteSynced=true
                message=Backup completed
                """.formatted(Instant.now()));
        AdminSystemHealthController controller = new AdminSystemHealthController();
        ReflectionTestUtils.setField(controller, "backupStatusFile", statusFile.toString());

        AdminSystemHealthDto.Item item = ReflectionTestUtils.invokeMethod(controller, "backupHealth");

        assertThat(item).isNotNull();
        assertThat(item.getStatus()).isEqualTo("OK");
        assertThat(item.getSummary()).isEqualTo("备份与异机同步正常");
    }
}
