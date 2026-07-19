package com.idncar.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DataRetentionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DataRetentionService.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Scheduled(initialDelay = 600_000L, fixedDelay = 86_400_000L)
    public void deleteExpiredOperationalData() {
        int deleted = 0;
        deleted += jdbcTemplate.update(
                "DELETE FROM site_visit_logs WHERE create_time < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)");
        deleted += jdbcTemplate.update(
                "DELETE FROM qr_scan_logs WHERE create_time < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)");
        deleted += jdbcTemplate.update(
                "DELETE FROM login_records WHERE create_time < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)");
        deleted += jdbcTemplate.update("""
                DELETE FROM user_notifications
                WHERE read_status = 1
                  AND ((read_time IS NOT NULL AND read_time < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 180 DAY))
                    OR (read_time IS NULL AND create_time < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 180 DAY)))
                """);
        if (deleted > 0) {
            LOGGER.info("Deleted {} expired operational records", deleted);
        }
    }
}
