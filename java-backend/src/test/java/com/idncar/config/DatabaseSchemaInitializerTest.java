package com.idncar.config;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatabaseSchemaInitializerTest {

    @Test
    void favoriteIndexesSupportUserScopedPostJoin() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object.class), any(Object.class)))
                .thenAnswer(invocation -> "idx_post_favorites_user_id".equals(invocation.getArgument(3)) ? 1 : 0);
        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        setField(initializer, "jdbcTemplate", jdbcTemplate);

        invoke(initializer, "ensurePostFavoritesTable");

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).execute(sqlCaptor.capture());
        assertThat(sqlCaptor.getAllValues())
                .contains("CREATE INDEX idx_post_favorites_user_post ON post_favorites(user_id, post_id)")
                .contains("ALTER TABLE post_favorites DROP INDEX idx_post_favorites_user_id");
    }

    @Test
    void userPreparationClearsGeneratedProfilePlaceholders() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object.class), any(Object.class)))
                .thenReturn(1);
        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        setField(initializer, "jdbcTemplate", jdbcTemplate);

        invoke(initializer, "ensureUserColumns");

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).execute(sqlCaptor.capture());
        assertThat(sqlCaptor.getAllValues())
                .contains("UPDATE users SET avatar_url = NULL WHERE avatar_url LIKE 'https://api.dicebear.com/9.x/initials/svg?seed=%'")
                .contains("UPDATE users SET bio = NULL WHERE bio = '这个用户还没有填写个人简介。'");
    }

    @Test
    void postReportTableSupportsCommunityTargets() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        setField(initializer, "jdbcTemplate", jdbcTemplate);

        invoke(initializer, "ensurePostReportsTable");

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).execute(sqlCaptor.capture());
        assertThat(sqlCaptor.getValue())
                .contains("post_id BIGINT NULL")
                .contains("target_type VARCHAR(30) NULL")
                .contains("target_id BIGINT NULL")
                .contains("target_summary VARCHAR(240) NULL");
    }

    @Test
    void publicCodeIndexPreparationClearsHalfBrokenPublicLinksBeforeCreatingIndexes() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object.class)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object.class), any(Object.class)))
                .thenReturn(1);

        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        setField(initializer, "jdbcTemplate", jdbcTemplate);

        invoke(initializer, "ensureHotmailPublicCodeTokenUniqueIndex");

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).update(sqlCaptor.capture());

        List<String> updateSql = sqlCaptor.getAllValues();
        assertThat(updateSql).anySatisfy(sql -> {
            assertThat(sql).contains("SET public_code_token = NULL");
            assertThat(sql).contains("public_code_token = ''");
            assertThat(sql).contains("public_code_uid = ''");
            assertThat(sql).contains("public_code_token IS NULL AND (public_code_enabled = 1 OR public_code_uid IS NOT NULL)");
            assertThat(sql).contains("public_code_uid IS NULL AND public_code_token IS NOT NULL");
        });
    }

    @Test
    void productColumnPreparationClearsMissingStock() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object.class), any(Object.class)))
                .thenReturn(1);

        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        setField(initializer, "jdbcTemplate", jdbcTemplate);

        invoke(initializer, "ensureProductColumns");

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).execute(sqlCaptor.capture());

        assertThat(sqlCaptor.getAllValues())
                .contains("UPDATE products SET stock = 0 WHERE stock IS NULL");
        assertThat(sqlCaptor.getAllValues())
                .contains("UPDATE products SET stock = 0 WHERE delivery_type = 'CDK_EMAIL' AND stock <> 0");
    }

    private void invoke(Object target, String methodName) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName);
        method.setAccessible(true);
        method.invoke(target);
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
