package com.idncar.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

class DataRetentionServiceTest {

    @Test
    void cleanupKeepsUnreadNotificationsAndBusinessRecordsOutOfScope() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        DataRetentionService service = new DataRetentionService();
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbcTemplate);

        service.deleteExpiredOperationalData();

        verify(jdbcTemplate).update(contains("DELETE FROM site_visit_logs"));
        verify(jdbcTemplate).update(contains("DELETE FROM qr_scan_logs"));
        verify(jdbcTemplate).update(contains("DELETE FROM login_records"));
        verify(jdbcTemplate).update(contains("DELETE FROM user_notifications\nWHERE read_status = 1"));
        verifyNoMoreInteractions(jdbcTemplate);
    }
}
