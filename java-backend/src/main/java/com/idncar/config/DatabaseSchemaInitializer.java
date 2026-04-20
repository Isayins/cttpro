package com.idncar.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.schema.auto-init-enabled", havingValue = "true")
public class DatabaseSchemaInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureUserColumns();
        ensureLoginRecordsTable();
        ensureLoginRecordColumns();
        ensurePostColumns();
        ensureInviteCodesTable();
        ensureInviteCodeColumns();
        ensurePostLikesTable();
        ensurePostFavoritesTable();
        ensurePostReportsTable();
        ensurePostReportColumns();
        ensureCommunityChatMessagesTable();
        ensureCommunityChatMessageColumns();
        ensurePrivateChatMessagesTable();
        ensurePrivateChatMessageColumns();
        ensureCommunityTalkPostsTable();
        ensureCommunityTalkPostColumns();
        ensureCommunityTalkCommentsTable();
        ensureCommunityTalkCommentColumns();
        ensureDownloadResourcesTable();
        ensureDownloadResourceColumns();
        ensureQrCodesTable();
        ensureQrCodeColumns();
        ensureQrScanLogsTable();
        ensureQrScanLogColumns();
        ensureSiteNoticesTable();
        ensureSiteNoticeColumns();
        ensureSiteVisitLogsTable();
        ensureSiteVisitLogColumns();
        ensureAdminOperationLogsTable();
        ensureAdminOperationLogColumns();
        ensureUserNotificationsTable();
        ensureUserNotificationColumns();
        ensureOwnerAccount();
        ensureDefaultInviteCode();
        ensureDefaultDownloadResource();
        ensureDefaultSiteNotices();
    }

    private void ensureUserColumns() {
        ensureColumn("users", "email", "email VARCHAR(120) NULL");
        ensureColumn("users", "avatar_url", "avatar_url VARCHAR(255) NULL");
        ensureColumn("users", "bio", "bio TEXT NULL");
        ensureColumn("users", "status", "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        ensureColumn("users", "chat_visibility", "chat_visibility VARCHAR(20) NOT NULL DEFAULT 'ONLINE'");
        ensureIndex("users", "uk_users_email", "CREATE UNIQUE INDEX uk_users_email ON users(email)");
        jdbcTemplate.execute("UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR status = ''");
        jdbcTemplate.execute("UPDATE users SET chat_visibility = 'ONLINE' WHERE chat_visibility IS NULL OR chat_visibility = ''");
    }

    private void ensureLoginRecordsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS login_records (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NULL,
                    login_identity VARCHAR(120) NOT NULL,
                    ip_address VARCHAR(120) NULL,
                    user_agent VARCHAR(500) NULL,
                    device_type VARCHAR(30) NULL,
                    login_status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureLoginRecordColumns() {
        ensureColumn("login_records", "user_id", "user_id BIGINT NULL");
        ensureColumn("login_records", "login_identity", "login_identity VARCHAR(120) NOT NULL DEFAULT ''");
        ensureColumn("login_records", "ip_address", "ip_address VARCHAR(120) NULL");
        ensureColumn("login_records", "user_agent", "user_agent VARCHAR(500) NULL");
        ensureColumn("login_records", "device_type", "device_type VARCHAR(30) NULL");
        ensureColumn("login_records", "login_status", "login_status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'");
        ensureIndex("login_records", "idx_login_records_user_id", "CREATE INDEX idx_login_records_user_id ON login_records(user_id)");
        ensureIndex("login_records", "idx_login_records_create_time", "CREATE INDEX idx_login_records_create_time ON login_records(create_time)");
    }

    private void ensureInviteCodesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS invite_codes (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    code VARCHAR(32) NOT NULL UNIQUE,
                    created_by BIGINT NOT NULL,
                    used_by BIGINT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    is_reusable TINYINT(1) NOT NULL DEFAULT 0,
                    usage_count INT NOT NULL DEFAULT 0,
                    expires_at DATETIME NULL,
                    used_at DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureInviteCodeColumns() {
        ensureColumn("invite_codes", "is_reusable", "is_reusable TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("invite_codes", "usage_count", "usage_count INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE invite_codes SET is_reusable = 0 WHERE is_reusable IS NULL");
        jdbcTemplate.execute("UPDATE invite_codes SET usage_count = 0 WHERE usage_count IS NULL");
    }

    private void ensurePostColumns() {
        ensureColumn("posts", "category", "category VARCHAR(40) NULL");
        ensureColumn("posts", "tags", "tags VARCHAR(255) NULL");
        ensureColumn("posts", "pinned", "pinned TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("posts", "favorite_count", "favorite_count INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE posts SET pinned = 0 WHERE pinned IS NULL");
        jdbcTemplate.execute("UPDATE posts SET favorite_count = 0 WHERE favorite_count IS NULL");
    }

    private void ensurePostLikesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_likes (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    post_id BIGINT NOT NULL,
                    user_id BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_post_user (post_id, user_id)
                )
                """);
    }

    private void ensurePostFavoritesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_favorites (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    post_id BIGINT NOT NULL,
                    user_id BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_post_favorites_post_user (post_id, user_id)
                )
                """);
        ensureIndex("post_favorites", "idx_post_favorites_user_id", "CREATE INDEX idx_post_favorites_user_id ON post_favorites(user_id)");
        ensureIndex("post_favorites", "idx_post_favorites_post_id", "CREATE INDEX idx_post_favorites_post_id ON post_favorites(post_id)");
    }

    private void ensurePostReportsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_reports (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    post_id BIGINT NOT NULL,
                    reporter_id BIGINT NOT NULL,
                    reason VARCHAR(60) NOT NULL,
                    detail VARCHAR(500) NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    reviewed_by BIGINT NULL,
                    review_note VARCHAR(500) NULL,
                    reviewed_at DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensurePostReportColumns() {
        ensureColumn("post_reports", "detail", "detail VARCHAR(500) NULL");
        ensureColumn("post_reports", "status", "status VARCHAR(20) NOT NULL DEFAULT 'PENDING'");
        ensureColumn("post_reports", "reviewed_by", "reviewed_by BIGINT NULL");
        ensureColumn("post_reports", "review_note", "review_note VARCHAR(500) NULL");
        ensureColumn("post_reports", "reviewed_at", "reviewed_at DATETIME NULL");
        ensureIndex("post_reports", "idx_post_reports_post_id", "CREATE INDEX idx_post_reports_post_id ON post_reports(post_id)");
        ensureIndex("post_reports", "idx_post_reports_reporter_id", "CREATE INDEX idx_post_reports_reporter_id ON post_reports(reporter_id)");
        ensureIndex("post_reports", "idx_post_reports_status", "CREATE INDEX idx_post_reports_status ON post_reports(status)");
        ensureIndex("post_reports", "idx_post_reports_reviewed_by", "CREATE INDEX idx_post_reports_reviewed_by ON post_reports(reviewed_by)");
    }

    private void ensureCommunityChatMessagesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_chat_messages (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    room_id VARCHAR(32) NOT NULL,
                    author VARCHAR(40) NOT NULL,
                    avatar_seed VARCHAR(60) NULL,
                    content TEXT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureCommunityChatMessageColumns() {
        ensureColumn("community_chat_messages", "room_id", "room_id VARCHAR(32) NOT NULL DEFAULT 'general'");
        ensureColumn("community_chat_messages", "author", "author VARCHAR(40) NOT NULL DEFAULT 'Anonymous'");
        ensureColumn("community_chat_messages", "avatar_seed", "avatar_seed VARCHAR(60) NULL");
        ensureColumn("community_chat_messages", "content", "content TEXT NOT NULL");
        ensureIndex("community_chat_messages", "idx_community_chat_messages_room_id", "CREATE INDEX idx_community_chat_messages_room_id ON community_chat_messages(room_id)");
        ensureIndex("community_chat_messages", "idx_community_chat_messages_create_time", "CREATE INDEX idx_community_chat_messages_create_time ON community_chat_messages(create_time)");
    }

    private void ensurePrivateChatMessagesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS private_chat_messages (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    sender_id BIGINT NOT NULL,
                    recipient_id BIGINT NOT NULL,
                    content VARCHAR(1000) NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensurePrivateChatMessageColumns() {
        ensureColumn("private_chat_messages", "sender_id", "sender_id BIGINT NOT NULL");
        ensureColumn("private_chat_messages", "recipient_id", "recipient_id BIGINT NOT NULL");
        ensureColumn("private_chat_messages", "content", "content VARCHAR(1000) NOT NULL DEFAULT ''");
        ensureIndex("private_chat_messages", "idx_private_chat_messages_sender_id", "CREATE INDEX idx_private_chat_messages_sender_id ON private_chat_messages(sender_id)");
        ensureIndex("private_chat_messages", "idx_private_chat_messages_recipient_id", "CREATE INDEX idx_private_chat_messages_recipient_id ON private_chat_messages(recipient_id)");
        ensureIndex("private_chat_messages", "idx_private_chat_messages_create_time", "CREATE INDEX idx_private_chat_messages_create_time ON private_chat_messages(create_time)");
        ensureIndex("private_chat_messages", "idx_private_chat_messages_pair", "CREATE INDEX idx_private_chat_messages_pair ON private_chat_messages(sender_id, recipient_id, create_time)");
    }

    private void ensureCommunityTalkPostsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_talk_posts (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    author VARCHAR(40) NOT NULL,
                    avatar_seed VARCHAR(60) NULL,
                    content TEXT NOT NULL,
                    category VARCHAR(40) NULL,
                    likes INT NOT NULL DEFAULT 0,
                    pinned TINYINT(1) NOT NULL DEFAULT 0,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureCommunityTalkPostColumns() {
        ensureColumn("community_talk_posts", "author", "author VARCHAR(40) NOT NULL DEFAULT 'Anonymous'");
        ensureColumn("community_talk_posts", "avatar_seed", "avatar_seed VARCHAR(60) NULL");
        ensureColumn("community_talk_posts", "content", "content TEXT NOT NULL");
        ensureColumn("community_talk_posts", "category", "category VARCHAR(40) NULL");
        ensureColumn("community_talk_posts", "likes", "likes INT NOT NULL DEFAULT 0");
        ensureColumn("community_talk_posts", "pinned", "pinned TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("community_talk_posts", "update_time", "update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        jdbcTemplate.execute("UPDATE community_talk_posts SET likes = 0 WHERE likes IS NULL");
        jdbcTemplate.execute("UPDATE community_talk_posts SET pinned = 0 WHERE pinned IS NULL");
        ensureIndex("community_talk_posts", "idx_community_talk_posts_create_time", "CREATE INDEX idx_community_talk_posts_create_time ON community_talk_posts(create_time)");
        ensureIndex("community_talk_posts", "idx_community_talk_posts_category", "CREATE INDEX idx_community_talk_posts_category ON community_talk_posts(category)");
    }

    private void ensureCommunityTalkCommentsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_talk_comments (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    post_id BIGINT NOT NULL,
                    author VARCHAR(40) NOT NULL,
                    content VARCHAR(300) NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureCommunityTalkCommentColumns() {
        ensureColumn("community_talk_comments", "post_id", "post_id BIGINT NOT NULL");
        ensureColumn("community_talk_comments", "author", "author VARCHAR(40) NOT NULL DEFAULT 'Anonymous'");
        ensureColumn("community_talk_comments", "content", "content VARCHAR(300) NOT NULL DEFAULT ''");
        ensureIndex("community_talk_comments", "idx_community_talk_comments_post_id", "CREATE INDEX idx_community_talk_comments_post_id ON community_talk_comments(post_id)");
        ensureIndex("community_talk_comments", "idx_community_talk_comments_create_time", "CREATE INDEX idx_community_talk_comments_create_time ON community_talk_comments(create_time)");
    }

    private void ensureDownloadResourcesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS download_resources (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(120) NOT NULL,
                    version VARCHAR(50) NULL,
                    changelog TEXT NULL,
                    url VARCHAR(500) NOT NULL,
                    icon VARCHAR(255) NULL,
                    locked TINYINT(1) NOT NULL DEFAULT 0,
                    sort_order INT NOT NULL DEFAULT 0,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureDownloadResourceColumns() {
        ensureColumn("download_resources", "version", "version VARCHAR(50) NULL");
        ensureColumn("download_resources", "changelog", "changelog TEXT NULL");
        ensureColumn("download_resources", "icon", "icon VARCHAR(255) NULL");
        ensureColumn("download_resources", "locked", "locked TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("download_resources", "sort_order", "sort_order INT NOT NULL DEFAULT 0");
        ensureColumn("download_resources", "category", "category VARCHAR(40) NULL");
        ensureColumn("download_resources", "file_size", "file_size VARCHAR(40) NULL");
        ensureColumn("download_resources", "checksum_sha256", "checksum_sha256 VARCHAR(128) NULL");
        ensureColumn("download_resources", "download_count", "download_count INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE download_resources SET locked = 0 WHERE locked IS NULL");
        jdbcTemplate.execute("UPDATE download_resources SET sort_order = 0 WHERE sort_order IS NULL");
        jdbcTemplate.execute("UPDATE download_resources SET download_count = 0 WHERE download_count IS NULL");
    }

    private void ensureQrCodesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS qr_codes (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(80) NOT NULL,
                    description VARCHAR(255) NULL,
                    short_code VARCHAR(24) NOT NULL UNIQUE,
                    target_url VARCHAR(500) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    login_required TINYINT(1) NOT NULL DEFAULT 0,
                    access_code_required TINYINT(1) NOT NULL DEFAULT 0,
                    access_code VARCHAR(64) NULL,
                    expires_at DATETIME NULL,
                    created_by BIGINT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureQrCodeColumns() {
        ensureColumn("qr_codes", "description", "description VARCHAR(255) NULL");
        ensureColumn("qr_codes", "status", "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        ensureColumn("qr_codes", "login_required", "login_required TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("qr_codes", "access_code_required", "access_code_required TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("qr_codes", "access_code", "access_code VARCHAR(64) NULL");
        ensureColumn("qr_codes", "expires_at", "expires_at DATETIME NULL");
        ensureColumn("qr_codes", "created_by", "created_by BIGINT NOT NULL DEFAULT 1");
        ensureIndex("qr_codes", "uk_qr_codes_short_code", "CREATE UNIQUE INDEX uk_qr_codes_short_code ON qr_codes(short_code)");
    }

    private void ensureQrScanLogsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS qr_scan_logs (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    qr_code_id BIGINT NOT NULL,
                    user_id BIGINT NULL,
                    visitor_id VARCHAR(80) NULL,
                    session_id VARCHAR(80) NULL,
                    source VARCHAR(120) NULL,
                    device_type VARCHAR(30) NULL,
                    user_agent VARCHAR(500) NULL,
                    ip_address VARCHAR(120) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureQrScanLogColumns() {
        ensureColumn("qr_scan_logs", "user_id", "user_id BIGINT NULL");
        ensureColumn("qr_scan_logs", "visitor_id", "visitor_id VARCHAR(80) NULL");
        ensureColumn("qr_scan_logs", "session_id", "session_id VARCHAR(80) NULL");
        ensureColumn("qr_scan_logs", "source", "source VARCHAR(120) NULL");
        ensureColumn("qr_scan_logs", "device_type", "device_type VARCHAR(30) NULL");
        ensureColumn("qr_scan_logs", "user_agent", "user_agent VARCHAR(500) NULL");
        ensureColumn("qr_scan_logs", "ip_address", "ip_address VARCHAR(120) NULL");
        ensureIndex("qr_scan_logs", "idx_qr_scan_logs_qr_code_id", "CREATE INDEX idx_qr_scan_logs_qr_code_id ON qr_scan_logs(qr_code_id)");
        ensureIndex("qr_scan_logs", "idx_qr_scan_logs_create_time", "CREATE INDEX idx_qr_scan_logs_create_time ON qr_scan_logs(create_time)");
        ensureIndex("qr_scan_logs", "idx_qr_scan_logs_user_id", "CREATE INDEX idx_qr_scan_logs_user_id ON qr_scan_logs(user_id)");
    }

    private void ensureSiteNoticesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS site_notices (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(120) NOT NULL,
                    content TEXT NOT NULL,
                    published TINYINT(1) NOT NULL DEFAULT 1,
                    sort_order INT NOT NULL DEFAULT 0,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureSiteNoticeColumns() {
        ensureColumn("site_notices", "published", "published TINYINT(1) NOT NULL DEFAULT 1");
        ensureColumn("site_notices", "sort_order", "sort_order INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE site_notices SET published = 1 WHERE published IS NULL");
        jdbcTemplate.execute("UPDATE site_notices SET sort_order = 0 WHERE sort_order IS NULL");
    }

    private void ensureSiteVisitLogsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS site_visit_logs (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    path VARCHAR(255) NOT NULL,
                    page_title VARCHAR(120) NULL,
                    visitor_id VARCHAR(80) NOT NULL,
                    session_id VARCHAR(80) NOT NULL,
                    user_id BIGINT NULL,
                    referrer VARCHAR(500) NULL,
                    source VARCHAR(120) NULL,
                    device_type VARCHAR(30) NULL,
                    user_agent VARCHAR(500) NULL,
                    ip_address VARCHAR(120) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureSiteVisitLogColumns() {
        ensureColumn("site_visit_logs", "page_title", "page_title VARCHAR(120) NULL");
        ensureColumn("site_visit_logs", "visitor_id", "visitor_id VARCHAR(80) NOT NULL DEFAULT ''");
        ensureColumn("site_visit_logs", "session_id", "session_id VARCHAR(80) NOT NULL DEFAULT ''");
        ensureColumn("site_visit_logs", "user_id", "user_id BIGINT NULL");
        ensureColumn("site_visit_logs", "referrer", "referrer VARCHAR(500) NULL");
        ensureColumn("site_visit_logs", "source", "source VARCHAR(120) NULL");
        ensureColumn("site_visit_logs", "device_type", "device_type VARCHAR(30) NULL");
        ensureColumn("site_visit_logs", "user_agent", "user_agent VARCHAR(500) NULL");
        ensureColumn("site_visit_logs", "ip_address", "ip_address VARCHAR(120) NULL");
        ensureIndex("site_visit_logs", "idx_site_visit_logs_create_time", "CREATE INDEX idx_site_visit_logs_create_time ON site_visit_logs(create_time)");
        ensureIndex("site_visit_logs", "idx_site_visit_logs_path", "CREATE INDEX idx_site_visit_logs_path ON site_visit_logs(path)");
        ensureIndex("site_visit_logs", "idx_site_visit_logs_visitor_id", "CREATE INDEX idx_site_visit_logs_visitor_id ON site_visit_logs(visitor_id)");
        ensureIndex("site_visit_logs", "idx_site_visit_logs_user_id", "CREATE INDEX idx_site_visit_logs_user_id ON site_visit_logs(user_id)");
    }

    private void ensureAdminOperationLogsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS admin_operation_logs (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    operator_id BIGINT NOT NULL,
                    operator_role VARCHAR(20) NOT NULL,
                    action_type VARCHAR(40) NOT NULL,
                    target_type VARCHAR(40) NOT NULL,
                    target_id BIGINT NULL,
                    target_name VARCHAR(160) NULL,
                    detail VARCHAR(500) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureAdminOperationLogColumns() {
        ensureColumn("admin_operation_logs", "operator_id", "operator_id BIGINT NOT NULL DEFAULT 0");
        ensureColumn("admin_operation_logs", "operator_role", "operator_role VARCHAR(20) NOT NULL DEFAULT 'ADMIN'");
        ensureColumn("admin_operation_logs", "action_type", "action_type VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN'");
        ensureColumn("admin_operation_logs", "target_type", "target_type VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN'");
        ensureColumn("admin_operation_logs", "target_id", "target_id BIGINT NULL");
        ensureColumn("admin_operation_logs", "target_name", "target_name VARCHAR(160) NULL");
        ensureColumn("admin_operation_logs", "detail", "detail VARCHAR(500) NULL");
        ensureIndex("admin_operation_logs", "idx_admin_operation_logs_operator_id", "CREATE INDEX idx_admin_operation_logs_operator_id ON admin_operation_logs(operator_id)");
        ensureIndex("admin_operation_logs", "idx_admin_operation_logs_create_time", "CREATE INDEX idx_admin_operation_logs_create_time ON admin_operation_logs(create_time)");
        ensureIndex("admin_operation_logs", "idx_admin_operation_logs_target_type", "CREATE INDEX idx_admin_operation_logs_target_type ON admin_operation_logs(target_type)");
    }

    private void ensureUserNotificationsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_notifications (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NOT NULL,
                    type VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
                    title VARCHAR(120) NOT NULL,
                    content VARCHAR(500) NOT NULL,
                    related_path VARCHAR(255) NULL,
                    read_status TINYINT(1) NOT NULL DEFAULT 0,
                    read_time DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureUserNotificationColumns() {
        ensureColumn("user_notifications", "type", "type VARCHAR(40) NOT NULL DEFAULT 'SYSTEM'");
        ensureColumn("user_notifications", "title", "title VARCHAR(120) NOT NULL DEFAULT '系统通知'");
        ensureColumn("user_notifications", "content", "content VARCHAR(500) NOT NULL DEFAULT ''");
        ensureColumn("user_notifications", "related_path", "related_path VARCHAR(255) NULL");
        ensureColumn("user_notifications", "read_status", "read_status TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("user_notifications", "read_time", "read_time DATETIME NULL");
        jdbcTemplate.execute("UPDATE user_notifications SET read_status = 0 WHERE read_status IS NULL");
        ensureIndex("user_notifications", "idx_user_notifications_user_id", "CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id)");
        ensureIndex("user_notifications", "idx_user_notifications_read_status", "CREATE INDEX idx_user_notifications_read_status ON user_notifications(read_status)");
        ensureIndex("user_notifications", "idx_user_notifications_create_time", "CREATE INDEX idx_user_notifications_create_time ON user_notifications(create_time)");
    }

    private void ensureOwnerAccount() {
        Integer ownerCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE role = 'OWNER'",
                Integer.class
        );

        if (ownerCount != null && ownerCount == 0) {
            jdbcTemplate.update(
                    """
                    UPDATE users
                    SET role = 'OWNER'
                    WHERE id = (
                        SELECT id FROM (
                            SELECT id FROM users
                            WHERE role IN ('OWNER', 'ADMIN')
                            ORDER BY id
                            LIMIT 1
                        ) AS first_manager
                    )
                    """
            );
        }
    }

    private void ensureDefaultInviteCode() {
        Long managerUserId = jdbcTemplate.query(
                "SELECT id FROM users WHERE role IN ('OWNER', 'ADMIN') ORDER BY CASE WHEN role = 'OWNER' THEN 0 ELSE 1 END, id LIMIT 1",
                rs -> rs.next() ? rs.getLong(1) : 1L
        );

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM invite_codes WHERE code = ?",
                Integer.class,
                "IDNCAR2026"
        );

        if (count != null && count == 0) {
            jdbcTemplate.update(
                    """
                    INSERT INTO invite_codes (code, created_by, status, is_reusable, usage_count, expires_at)
                    VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 3650 DAY))
                    """,
                    "IDNCAR2026",
                    managerUserId,
                    "ACTIVE",
                    true,
                    0
            );
        }

        jdbcTemplate.update(
                """
                UPDATE invite_codes
                SET created_by = COALESCE(created_by, ?),
                    status = 'ACTIVE',
                    is_reusable = 1,
                    usage_count = COALESCE(usage_count, 0),
                    used_by = NULL,
                    used_at = NULL,
                    expires_at = COALESCE(expires_at, DATE_ADD(NOW(), INTERVAL 3650 DAY))
                WHERE code = ?
                """,
                managerUserId,
                "IDNCAR2026"
        );
    }

    private void ensureDefaultDownloadResource() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM download_resources WHERE url = ?",
                Integer.class,
                "https://idncar.com/downloads/idncar-win.zip"
        );

        if (count != null && count == 0) {
            jdbcTemplate.update(
                    """
                    INSERT INTO download_resources (title, version, changelog, url, icon, locked, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    "IDNCAR Windows Client",
                    "v1.0.0",
                    "Initial release package.",
                    "https://idncar.com/downloads/idncar-win.zip",
                    "https://idncar.com/images/idncar.jpg",
                    false,
                    1
            );
        }
    }

    private void ensureDefaultSiteNotices() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM site_notices",
                Integer.class
        );

        if (count != null && count == 0) {
            jdbcTemplate.batchUpdate(
                    """
                    INSERT INTO site_notices (title, content, published, sort_order)
                    VALUES (?, ?, ?, ?)
                    """,
                    java.util.List.of(
                            new Object[]{
                                    "新用户注册说明",
                                    "注册账号需要邀请码和邮箱验证码，如需开通请先联系管理员获取邀请码。",
                                    true,
                                    1
                            },
                            new Object[]{
                                    "下载中心提示",
                                    "下载中心会持续更新客户端和相关资源，请优先查看版本号和更新说明后再下载。",
                                    true,
                                    2
                            },
                            new Object[]{
                                    "社区交流提醒",
                                    "完善昵称、头像和个人简介后，论坛内的发帖与回复会同步展示你的最新资料。",
                                    true,
                                    3
                            }
                    )
            );
        }
    }

    private void ensureColumn(String tableName, String columnName, String columnDefinition) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class,
                tableName,
                columnName
        );

        if (count != null && count == 0) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnDefinition);
        }
    }

    private void ensureIndex(String tableName, String indexName, String createSql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
                Integer.class,
                tableName,
                indexName
        );

        if (count != null && count == 0) {
            jdbcTemplate.execute(createSql);
        }
    }
}
