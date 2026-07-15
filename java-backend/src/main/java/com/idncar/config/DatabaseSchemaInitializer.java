package com.idncar.config;

import com.idncar.util.HotmailCredentialCrypto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.schema.auto-init-enabled", havingValue = "true")
public class DatabaseSchemaInitializer implements ApplicationRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private HotmailCredentialCrypto hotmailCredentialCrypto;

    @Override
    public void run(ApplicationArguments args) {
        ensureUserColumns();
        ensureLoginRecordsTable();
        ensureLoginRecordColumns();
        ensurePostColumns();
        ensureForumBoardsTable();
        ensureForumBoardColumns();
        ensureForumBoardOwnerApplicationsTable();
        ensureForumBoardOwnerApplicationColumns();
        ensureForumBoardUserStatsTable();
        ensureForumBoardUserStatsColumns();
        ensureInviteCodesTable();
        ensureInviteCodeColumns();
        ensurePostLikesTable();
        ensurePostFavoritesTable();
        ensurePostReportsTable();
        ensurePostReportColumns();
        ensureForumQueryIndexes();
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
        ensureProductsTable();
        ensureProductColumns();
        ensureProductDeliveryCodesTable();
        ensureProductDeliveryCodeColumns();
        ensureProductCouponCodesTable();
        ensureProductCouponCodeColumns();
        ensurePaymentOrdersTable();
        ensurePaymentOrderColumns();
        ensureMailSendLogsTable();
        ensureMailSendLogColumns();
        ensurePaymentVmqSettingsTable();
        ensurePaymentVmqSettingColumns();
        ensurePaymentVmqEventsTable();
        ensurePaymentVmqEventColumns();
        ensureDefaultVmqPaymentSetting();
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
        ensureHotmailAccountsTable();
        ensureHotmailAccountColumns();
        normalizeHotmailAccounts();
        ensureOwnerAccount();
        ensureDefaultInviteCode();
        ensureDefaultDownloadResource();
        ensureDefaultSiteNotices();
        ensureDefaultForumBoards();
    }

    private void ensureUserColumns() {
        ensureColumn("users", "email", "email VARCHAR(120) NULL");
        ensureColumn("users", "avatar_url", "avatar_url VARCHAR(255) NULL");
        ensureColumn("users", "bio", "bio TEXT NULL");
        ensureColumn("users", "status", "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        ensureColumn("users", "chat_visibility", "chat_visibility VARCHAR(20) NOT NULL DEFAULT 'ONLINE'");
        ensureColumn("users", "experience", "experience INT NOT NULL DEFAULT 0");
        ensureColumn("users", "level", "level INT NOT NULL DEFAULT 1");
        ensureColumn("users", "consecutive_sign_in_days", "consecutive_sign_in_days INT NOT NULL DEFAULT 0");
        ensureColumn("users", "last_sign_in_at", "last_sign_in_at DATETIME NULL");
        ensureIndex("users", "uk_users_email", "CREATE UNIQUE INDEX uk_users_email ON users(email)");
        jdbcTemplate.execute("UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR status = ''");
        jdbcTemplate.execute("UPDATE users SET chat_visibility = 'ONLINE' WHERE chat_visibility IS NULL OR chat_visibility = ''");
        jdbcTemplate.execute("UPDATE users SET experience = 0 WHERE experience IS NULL");
        jdbcTemplate.execute("UPDATE users SET level = 1 WHERE level IS NULL OR level < 1");
        jdbcTemplate.execute("UPDATE users SET consecutive_sign_in_days = 0 WHERE consecutive_sign_in_days IS NULL OR consecutive_sign_in_days < 0");
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

    private void ensureForumBoardsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS forum_boards (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(40) NOT NULL,
                    description VARCHAR(200) NULL,
                    avatar_url VARCHAR(500) NULL,
                    level_title_config TEXT NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    active TINYINT(1) NOT NULL DEFAULT 1,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_forum_boards_name (name)
                )
                """);
    }

    private void ensureForumBoardColumns() {
        ensureColumn("forum_boards", "name", "name VARCHAR(40) NOT NULL DEFAULT ''");
        ensureColumn("forum_boards", "description", "description VARCHAR(200) NULL");
        ensureColumn("forum_boards", "avatar_url", "avatar_url VARCHAR(500) NULL");
        ensureColumn("forum_boards", "owner_user_id", "owner_user_id BIGINT NULL");
        ensureColumn("forum_boards", "level_title_config", "level_title_config TEXT NULL");
        ensureColumn("forum_boards", "sort_order", "sort_order INT NOT NULL DEFAULT 0");
        ensureColumn("forum_boards", "active", "active TINYINT(1) NOT NULL DEFAULT 1");
        ensureIndex("forum_boards", "uk_forum_boards_name", "CREATE UNIQUE INDEX uk_forum_boards_name ON forum_boards(name)");
        ensureIndex("forum_boards", "idx_forum_boards_active_sort", "CREATE INDEX idx_forum_boards_active_sort ON forum_boards(active, sort_order)");
        ensureIndex("forum_boards", "idx_forum_boards_owner_user_id", "CREATE INDEX idx_forum_boards_owner_user_id ON forum_boards(owner_user_id)");
        jdbcTemplate.execute("UPDATE forum_boards SET sort_order = 0 WHERE sort_order IS NULL");
        jdbcTemplate.execute("UPDATE forum_boards SET active = 1 WHERE active IS NULL");
    }

    private void ensureForumBoardOwnerApplicationsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS forum_board_owner_applications (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    board_id BIGINT NOT NULL,
                    applicant_id BIGINT NOT NULL,
                    reason VARCHAR(500) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    reviewed_by BIGINT NULL,
                    review_note VARCHAR(500) NULL,
                    reviewed_at DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureForumBoardOwnerApplicationColumns() {
        ensureColumn("forum_board_owner_applications", "board_id", "board_id BIGINT NOT NULL");
        ensureColumn("forum_board_owner_applications", "applicant_id", "applicant_id BIGINT NOT NULL");
        ensureColumn("forum_board_owner_applications", "reason", "reason VARCHAR(500) NOT NULL DEFAULT ''");
        ensureColumn("forum_board_owner_applications", "status", "status VARCHAR(20) NOT NULL DEFAULT 'PENDING'");
        ensureColumn("forum_board_owner_applications", "reviewed_by", "reviewed_by BIGINT NULL");
        ensureColumn("forum_board_owner_applications", "review_note", "review_note VARCHAR(500) NULL");
        ensureColumn("forum_board_owner_applications", "reviewed_at", "reviewed_at DATETIME NULL");
        ensureIndex("forum_board_owner_applications", "idx_forum_board_owner_applications_board_status", "CREATE INDEX idx_forum_board_owner_applications_board_status ON forum_board_owner_applications(board_id, status)");
        ensureIndex("forum_board_owner_applications", "idx_forum_board_owner_applications_applicant_status", "CREATE INDEX idx_forum_board_owner_applications_applicant_status ON forum_board_owner_applications(applicant_id, status)");
        ensureIndex("forum_board_owner_applications", "idx_forum_board_owner_applications_board_applicant_status", "CREATE INDEX idx_forum_board_owner_applications_board_applicant_status ON forum_board_owner_applications(board_id, applicant_id, status)");
        ensureIndex("forum_board_owner_applications", "idx_forum_board_owner_applications_status_time", "CREATE INDEX idx_forum_board_owner_applications_status_time ON forum_board_owner_applications(status, create_time)");
        jdbcTemplate.execute("UPDATE forum_board_owner_applications SET status = 'PENDING' WHERE status IS NULL OR status = ''");
    }

    private void ensureForumBoardUserStatsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS forum_board_user_stats (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    board_id BIGINT NOT NULL,
                    user_id BIGINT NOT NULL,
                    experience INT NOT NULL DEFAULT 0,
                    level INT NOT NULL DEFAULT 1,
                    consecutive_sign_in_days INT NOT NULL DEFAULT 0,
                    last_sign_in_at DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_forum_board_user_stats_board_user (board_id, user_id),
                    KEY idx_forum_board_user_stats_board_sign_in (board_id, consecutive_sign_in_days, experience)
                )
                """);
    }

    private void ensureForumBoardUserStatsColumns() {
        ensureColumn("forum_board_user_stats", "board_id", "board_id BIGINT NOT NULL");
        ensureColumn("forum_board_user_stats", "user_id", "user_id BIGINT NOT NULL");
        ensureColumn("forum_board_user_stats", "experience", "experience INT NOT NULL DEFAULT 0");
        ensureColumn("forum_board_user_stats", "level", "level INT NOT NULL DEFAULT 1");
        ensureColumn("forum_board_user_stats", "consecutive_sign_in_days", "consecutive_sign_in_days INT NOT NULL DEFAULT 0");
        ensureColumn("forum_board_user_stats", "last_sign_in_at", "last_sign_in_at DATETIME NULL");
        ensureIndex("forum_board_user_stats", "uk_forum_board_user_stats_board_user", "CREATE UNIQUE INDEX uk_forum_board_user_stats_board_user ON forum_board_user_stats(board_id, user_id)");
        ensureIndex("forum_board_user_stats", "idx_forum_board_user_stats_board_sign_in", "CREATE INDEX idx_forum_board_user_stats_board_sign_in ON forum_board_user_stats(board_id, consecutive_sign_in_days, experience)");
        jdbcTemplate.execute("UPDATE forum_board_user_stats SET experience = 0 WHERE experience IS NULL");
        jdbcTemplate.execute("UPDATE forum_board_user_stats SET level = 1 WHERE level IS NULL OR level < 1");
        jdbcTemplate.execute("UPDATE forum_board_user_stats SET consecutive_sign_in_days = 0 WHERE consecutive_sign_in_days IS NULL");
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

    private void ensureForumQueryIndexes() {
        if (tableExists("posts")) {
            ensureIndex("posts", "idx_posts_pinned_create_time", "CREATE INDEX idx_posts_pinned_create_time ON posts(pinned, create_time)");
            ensureIndex("posts", "idx_posts_user_id_create_time", "CREATE INDEX idx_posts_user_id_create_time ON posts(user_id, create_time)");
            ensureIndex("posts", "idx_posts_category_create_time", "CREATE INDEX idx_posts_category_create_time ON posts(category, create_time)");
        }

        if (tableExists("replies")) {
            ensureIndex("replies", "idx_replies_post_id_create_time", "CREATE INDEX idx_replies_post_id_create_time ON replies(post_id, create_time)");
        }

        if (tableExists("post_likes")) {
            ensureIndex("post_likes", "idx_post_likes_user_id_post_id", "CREATE INDEX idx_post_likes_user_id_post_id ON post_likes(user_id, post_id)");
        }
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
                    content TEXT NOT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensurePrivateChatMessageColumns() {
        ensureColumn("private_chat_messages", "sender_id", "sender_id BIGINT NOT NULL");
        ensureColumn("private_chat_messages", "recipient_id", "recipient_id BIGINT NOT NULL");
        ensureColumn("private_chat_messages", "content", "content TEXT NOT NULL");
        ensureTextColumn("private_chat_messages", "content");
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
        ensureColumn("download_resources", "download_password_hash", "download_password_hash VARCHAR(100) NULL");
        ensureColumn("download_resources", "sort_order", "sort_order INT NOT NULL DEFAULT 0");
        ensureColumn("download_resources", "category", "category VARCHAR(40) NULL");
        ensureColumn("download_resources", "file_size", "file_size VARCHAR(40) NULL");
        ensureColumn("download_resources", "checksum_sha256", "checksum_sha256 VARCHAR(128) NULL");
        ensureColumn("download_resources", "download_count", "download_count INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE download_resources SET locked = 0 WHERE locked IS NULL");
        jdbcTemplate.execute("UPDATE download_resources SET sort_order = 0 WHERE sort_order IS NULL");
        jdbcTemplate.execute("UPDATE download_resources SET download_count = 0 WHERE download_count IS NULL");
    }

    private void ensurePaymentOrdersTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS payment_orders (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    channel VARCHAR(30) NOT NULL DEFAULT 'ALIPAY_F2F',
                    out_trade_no VARCHAR(64) NOT NULL,
                    trade_no VARCHAR(64) NULL,
                    buyer_logon_id VARCHAR(120) NULL,
                    subject VARCHAR(256) NOT NULL,
                    body VARCHAR(500) NULL,
                    total_amount DECIMAL(12,2) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
                    qr_code VARCHAR(512) NULL,
                    resource_type VARCHAR(60) NULL,
                    resource_id BIGINT NULL,
                    payer_user_id BIGINT NULL,
                    delivery_email VARCHAR(120) NULL,
                    expire_time DATETIME NULL,
                    paid_time DATETIME NULL,
                    closed_time DATETIME NULL,
                    paid_handled TINYINT(1) NOT NULL DEFAULT 0,
                    notify_payload TEXT NULL,
                    last_error VARCHAR(500) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no)
                )
                """);
    }

    private void ensureProductsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(120) NOT NULL,
                    subtitle VARCHAR(180) NULL,
                    description TEXT NULL,
                    image_url VARCHAR(500) NULL,
                    price DECIMAL(12,2) NOT NULL,
                    stock INT NOT NULL DEFAULT 0,
                    sales_count INT NOT NULL DEFAULT 0,
                    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
                    sort_order INT NOT NULL DEFAULT 0,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureProductColumns() {
        ensureColumn("products", "subtitle", "subtitle VARCHAR(180) NULL");
        ensureColumn("products", "description", "description TEXT NULL");
        ensureColumn("products", "image_url", "image_url VARCHAR(500) NULL");
        ensureColumn("products", "stock", "stock INT NOT NULL DEFAULT 0");
        ensureColumn("products", "sales_count", "sales_count INT NOT NULL DEFAULT 0");
        ensureColumn("products", "delivery_type", "delivery_type VARCHAR(30) NOT NULL DEFAULT 'NONE'");
        ensureColumn("products", "delivery_instructions", "delivery_instructions TEXT NULL");
        ensureColumn("products", "status", "status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'");
        ensureColumn("products", "sort_order", "sort_order INT NOT NULL DEFAULT 0");
        jdbcTemplate.execute("UPDATE products SET stock = 0 WHERE stock IS NULL");
        jdbcTemplate.execute("UPDATE products SET sales_count = 0 WHERE sales_count IS NULL");
        jdbcTemplate.execute("UPDATE products SET delivery_type = 'NONE' WHERE delivery_type IS NULL OR delivery_type = ''");
        jdbcTemplate.execute("UPDATE products SET stock = 0 WHERE delivery_type = 'CDK_EMAIL' AND stock <> 0");
        jdbcTemplate.execute("UPDATE products SET status = 'DRAFT' WHERE status IS NULL OR status = ''");
        jdbcTemplate.execute("UPDATE products SET sort_order = 0 WHERE sort_order IS NULL");
        ensureIndex("products", "idx_products_status_sort_order", "CREATE INDEX idx_products_status_sort_order ON products(status, sort_order)");
        ensureIndex("products", "idx_products_update_time", "CREATE INDEX idx_products_update_time ON products(update_time)");
    }

    private void ensureProductDeliveryCodesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS product_delivery_codes (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    product_id BIGINT NOT NULL,
                    code VARCHAR(500) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
                    created_by BIGINT NOT NULL,
                    assigned_to BIGINT NULL,
                    order_no VARCHAR(64) NULL,
                    assigned_at DATETIME NULL,
                    sent_at DATETIME NULL,
                    batch_no VARCHAR(40) NULL,
                    note VARCHAR(300) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_product_delivery_codes_product_code (product_id, code)
                )
                """);
    }

    private void ensureProductDeliveryCodeColumns() {
        ensureColumn("product_delivery_codes", "product_id", "product_id BIGINT NOT NULL");
        ensureColumn("product_delivery_codes", "code", "code VARCHAR(500) NOT NULL");
        ensureColumn("product_delivery_codes", "status", "status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'");
        ensureColumn("product_delivery_codes", "created_by", "created_by BIGINT NOT NULL DEFAULT 1");
        ensureColumn("product_delivery_codes", "assigned_to", "assigned_to BIGINT NULL");
        ensureColumn("product_delivery_codes", "order_no", "order_no VARCHAR(64) NULL");
        ensureColumn("product_delivery_codes", "assigned_at", "assigned_at DATETIME NULL");
        ensureColumn("product_delivery_codes", "sent_at", "sent_at DATETIME NULL");
        ensureColumn("product_delivery_codes", "batch_no", "batch_no VARCHAR(40) NULL");
        ensureColumn("product_delivery_codes", "note", "note VARCHAR(300) NULL");
        ensureIndex("product_delivery_codes", "uk_product_delivery_codes_product_code", "CREATE UNIQUE INDEX uk_product_delivery_codes_product_code ON product_delivery_codes(product_id, code)");
        ensureIndex("product_delivery_codes", "idx_product_delivery_codes_product_status", "CREATE INDEX idx_product_delivery_codes_product_status ON product_delivery_codes(product_id, status)");
        ensureIndex("product_delivery_codes", "idx_product_delivery_codes_batch_no", "CREATE INDEX idx_product_delivery_codes_batch_no ON product_delivery_codes(batch_no)");
        ensureIndex("product_delivery_codes", "idx_product_delivery_codes_order_no", "CREATE INDEX idx_product_delivery_codes_order_no ON product_delivery_codes(order_no)");
    }

    private void ensureProductCouponCodesTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS product_coupon_codes (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    code VARCHAR(32) NOT NULL,
                    product_id BIGINT NOT NULL,
                    discount_type VARCHAR(20) NOT NULL,
                    discount_value DECIMAL(12,2) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    created_by BIGINT NOT NULL,
                    used_by BIGINT NULL,
                    used_order_no VARCHAR(64) NULL,
                    used_at DATETIME NULL,
                    locked_by BIGINT NULL,
                    lock_order_no VARCHAR(64) NULL,
                    locked_at DATETIME NULL,
                    expires_at DATETIME NULL,
                    batch_no VARCHAR(40) NULL,
                    note VARCHAR(300) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_product_coupon_codes_code (code)
                )
                """);
    }

    private void ensureProductCouponCodeColumns() {
        ensureColumn("product_coupon_codes", "product_id", "product_id BIGINT NOT NULL");
        ensureColumn("product_coupon_codes", "discount_type", "discount_type VARCHAR(20) NOT NULL DEFAULT 'AMOUNT'");
        ensureColumn("product_coupon_codes", "discount_value", "discount_value DECIMAL(12,2) NOT NULL DEFAULT 0");
        ensureColumn("product_coupon_codes", "status", "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        ensureColumn("product_coupon_codes", "created_by", "created_by BIGINT NOT NULL DEFAULT 1");
        ensureColumn("product_coupon_codes", "used_by", "used_by BIGINT NULL");
        ensureColumn("product_coupon_codes", "used_order_no", "used_order_no VARCHAR(64) NULL");
        ensureColumn("product_coupon_codes", "used_at", "used_at DATETIME NULL");
        ensureColumn("product_coupon_codes", "locked_by", "locked_by BIGINT NULL");
        ensureColumn("product_coupon_codes", "lock_order_no", "lock_order_no VARCHAR(64) NULL");
        ensureColumn("product_coupon_codes", "locked_at", "locked_at DATETIME NULL");
        ensureColumn("product_coupon_codes", "expires_at", "expires_at DATETIME NULL");
        ensureColumn("product_coupon_codes", "batch_no", "batch_no VARCHAR(40) NULL");
        ensureColumn("product_coupon_codes", "note", "note VARCHAR(300) NULL");
        ensureIndex("product_coupon_codes", "uk_product_coupon_codes_code", "CREATE UNIQUE INDEX uk_product_coupon_codes_code ON product_coupon_codes(code)");
        ensureIndex("product_coupon_codes", "idx_product_coupon_codes_product_status", "CREATE INDEX idx_product_coupon_codes_product_status ON product_coupon_codes(product_id, status)");
        ensureIndex("product_coupon_codes", "idx_product_coupon_codes_status_expires", "CREATE INDEX idx_product_coupon_codes_status_expires ON product_coupon_codes(status, expires_at)");
        ensureIndex("product_coupon_codes", "idx_product_coupon_codes_batch_no", "CREATE INDEX idx_product_coupon_codes_batch_no ON product_coupon_codes(batch_no)");
        ensureIndex("product_coupon_codes", "idx_product_coupon_codes_lock_order_no", "CREATE INDEX idx_product_coupon_codes_lock_order_no ON product_coupon_codes(lock_order_no)");
    }

    private void ensurePaymentOrderColumns() {
        ensureColumn("payment_orders", "channel", "channel VARCHAR(30) NOT NULL DEFAULT 'ALIPAY_F2F'");
        ensureColumn("payment_orders", "trade_no", "trade_no VARCHAR(64) NULL");
        ensureColumn("payment_orders", "buyer_logon_id", "buyer_logon_id VARCHAR(120) NULL");
        ensureColumn("payment_orders", "body", "body VARCHAR(500) NULL");
        ensureColumn("payment_orders", "original_amount", "original_amount DECIMAL(12,2) NULL");
        ensureColumn("payment_orders", "discount_amount", "discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0");
        ensureColumn("payment_orders", "coupon_code", "coupon_code VARCHAR(32) NULL");
        ensureColumn("payment_orders", "coupon_code_id", "coupon_code_id BIGINT NULL");
        ensureColumn("payment_orders", "status", "status VARCHAR(30) NOT NULL DEFAULT 'CREATED'");
        ensureColumn("payment_orders", "qr_code", "qr_code VARCHAR(512) NULL");
        ensureColumn("payment_orders", "resource_type", "resource_type VARCHAR(60) NULL");
        ensureColumn("payment_orders", "resource_id", "resource_id BIGINT NULL");
        ensureColumn("payment_orders", "payer_user_id", "payer_user_id BIGINT NULL");
        ensureColumn("payment_orders", "delivery_email", "delivery_email VARCHAR(120) NULL");
        ensureColumn("payment_orders", "expire_time", "expire_time DATETIME NULL");
        ensureColumn("payment_orders", "paid_time", "paid_time DATETIME NULL");
        ensureColumn("payment_orders", "closed_time", "closed_time DATETIME NULL");
        ensureColumn("payment_orders", "paid_handled", "paid_handled TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("payment_orders", "notify_payload", "notify_payload TEXT NULL");
        ensureColumn("payment_orders", "last_error", "last_error VARCHAR(500) NULL");
        jdbcTemplate.execute("UPDATE payment_orders SET original_amount = total_amount WHERE original_amount IS NULL");
        jdbcTemplate.execute("UPDATE payment_orders SET discount_amount = 0 WHERE discount_amount IS NULL");
        jdbcTemplate.execute("UPDATE payment_orders SET paid_handled = 0 WHERE paid_handled IS NULL");
        ensureIndex("payment_orders", "uk_payment_orders_out_trade_no", "CREATE UNIQUE INDEX uk_payment_orders_out_trade_no ON payment_orders(out_trade_no)");
        ensureIndex("payment_orders", "idx_payment_orders_payer_user_id", "CREATE INDEX idx_payment_orders_payer_user_id ON payment_orders(payer_user_id)");
        ensureIndex("payment_orders", "idx_payment_orders_status", "CREATE INDEX idx_payment_orders_status ON payment_orders(status)");
        ensureIndex("payment_orders", "idx_payment_orders_create_time", "CREATE INDEX idx_payment_orders_create_time ON payment_orders(create_time)");
        ensureIndex("payment_orders", "idx_payment_orders_coupon_code_id", "CREATE INDEX idx_payment_orders_coupon_code_id ON payment_orders(coupon_code_id)");
    }

    private void ensureMailSendLogsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mail_send_logs (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    mail_type VARCHAR(40) NOT NULL DEFAULT 'DELIVERY',
                    trigger_type VARCHAR(40) NOT NULL DEFAULT 'AUTO',
                    order_no VARCHAR(64) NULL,
                    product_id BIGINT NULL,
                    product_title VARCHAR(160) NULL,
                    delivery_code_id BIGINT NULL,
                    recipient_email VARCHAR(120) NOT NULL,
                    subject VARCHAR(200) NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
                    error_message VARCHAR(600) NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureMailSendLogColumns() {
        ensureColumn("mail_send_logs", "mail_type", "mail_type VARCHAR(40) NOT NULL DEFAULT 'DELIVERY'");
        ensureColumn("mail_send_logs", "trigger_type", "trigger_type VARCHAR(40) NOT NULL DEFAULT 'AUTO'");
        ensureColumn("mail_send_logs", "order_no", "order_no VARCHAR(64) NULL");
        ensureColumn("mail_send_logs", "product_id", "product_id BIGINT NULL");
        ensureColumn("mail_send_logs", "product_title", "product_title VARCHAR(160) NULL");
        ensureColumn("mail_send_logs", "delivery_code_id", "delivery_code_id BIGINT NULL");
        ensureColumn("mail_send_logs", "recipient_email", "recipient_email VARCHAR(120) NOT NULL DEFAULT ''");
        ensureColumn("mail_send_logs", "subject", "subject VARCHAR(200) NULL");
        ensureColumn("mail_send_logs", "status", "status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'");
        ensureColumn("mail_send_logs", "error_message", "error_message VARCHAR(600) NULL");
        ensureColumn("mail_send_logs", "create_time", "create_time DATETIME DEFAULT CURRENT_TIMESTAMP");
        ensureIndex("mail_send_logs", "idx_mail_send_logs_create_time", "CREATE INDEX idx_mail_send_logs_create_time ON mail_send_logs(create_time)");
        ensureIndex("mail_send_logs", "idx_mail_send_logs_order_no", "CREATE INDEX idx_mail_send_logs_order_no ON mail_send_logs(order_no)");
        ensureIndex("mail_send_logs", "idx_mail_send_logs_status", "CREATE INDEX idx_mail_send_logs_status ON mail_send_logs(status)");
        ensureIndex("mail_send_logs", "idx_mail_send_logs_recipient_email", "CREATE INDEX idx_mail_send_logs_recipient_email ON mail_send_logs(recipient_email)");
    }

    private void ensurePaymentVmqSettingsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS payment_vmq_settings (
                    id BIGINT PRIMARY KEY,
                    enabled TINYINT(1) NOT NULL DEFAULT 0,
                    preferred TINYINT(1) NOT NULL DEFAULT 1,
                    pay_type INT NOT NULL DEFAULT 2,
                    communication_key VARCHAR(64) NOT NULL,
                    wx_pay_url VARCHAR(512) NULL,
                    alipay_pay_url VARCHAR(512) NULL,
                    amount_strategy VARCHAR(20) NOT NULL DEFAULT 'INCREASE',
                    order_timeout_minutes INT NOT NULL DEFAULT 5,
                    monitor_state VARCHAR(20) NOT NULL DEFAULT 'UNBOUND',
                    last_heart_time DATETIME NULL,
                    last_pay_time DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensurePaymentVmqSettingColumns() {
        ensureColumn("payment_vmq_settings", "enabled", "enabled TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("payment_vmq_settings", "preferred", "preferred TINYINT(1) NOT NULL DEFAULT 1");
        ensureColumn("payment_vmq_settings", "pay_type", "pay_type INT NOT NULL DEFAULT 2");
        ensureColumn("payment_vmq_settings", "communication_key", "communication_key VARCHAR(64) NOT NULL DEFAULT ''");
        ensureColumn("payment_vmq_settings", "wx_pay_url", "wx_pay_url VARCHAR(512) NULL");
        ensureColumn("payment_vmq_settings", "alipay_pay_url", "alipay_pay_url VARCHAR(512) NULL");
        ensureColumn("payment_vmq_settings", "amount_strategy", "amount_strategy VARCHAR(20) NOT NULL DEFAULT 'INCREASE'");
        ensureColumn("payment_vmq_settings", "order_timeout_minutes", "order_timeout_minutes INT NOT NULL DEFAULT 5");
        ensureColumn("payment_vmq_settings", "monitor_state", "monitor_state VARCHAR(20) NOT NULL DEFAULT 'UNBOUND'");
        ensureColumn("payment_vmq_settings", "last_heart_time", "last_heart_time DATETIME NULL");
        ensureColumn("payment_vmq_settings", "last_pay_time", "last_pay_time DATETIME NULL");
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET preferred = 1 WHERE preferred IS NULL");
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET pay_type = 2 WHERE pay_type IS NULL OR pay_type NOT IN (1, 2)");
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET amount_strategy = 'INCREASE' WHERE amount_strategy IS NULL OR amount_strategy = ''");
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET order_timeout_minutes = 5 WHERE order_timeout_minutes IS NULL OR order_timeout_minutes <= 0");
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET monitor_state = 'UNBOUND' WHERE monitor_state IS NULL OR monitor_state = ''");
    }

    private void ensurePaymentVmqEventsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS payment_vmq_events (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    event_id VARCHAR(64) NOT NULL,
                    pay_type INT NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    paid_at DATETIME NOT NULL,
                    order_no VARCHAR(64) NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
                    payload TEXT NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_payment_vmq_events_event_id (event_id),
                    KEY idx_payment_vmq_events_paid_at (paid_at),
                    KEY idx_payment_vmq_events_order_no (order_no)
                )
                """);
    }

    private void ensurePaymentVmqEventColumns() {
        ensureColumn("payment_vmq_events", "event_id", "event_id VARCHAR(64) NOT NULL");
        ensureColumn("payment_vmq_events", "pay_type", "pay_type INT NOT NULL");
        ensureColumn("payment_vmq_events", "amount", "amount DECIMAL(12,2) NOT NULL");
        ensureColumn("payment_vmq_events", "paid_at", "paid_at DATETIME NOT NULL");
        ensureColumn("payment_vmq_events", "order_no", "order_no VARCHAR(64) NULL");
        ensureColumn("payment_vmq_events", "status", "status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'");
        ensureColumn("payment_vmq_events", "payload", "payload TEXT NULL");
        ensureIndex("payment_vmq_events", "uk_payment_vmq_events_event_id", "CREATE UNIQUE INDEX uk_payment_vmq_events_event_id ON payment_vmq_events(event_id)");
        ensureIndex("payment_vmq_events", "idx_payment_vmq_events_paid_at", "CREATE INDEX idx_payment_vmq_events_paid_at ON payment_vmq_events(paid_at)");
        ensureIndex("payment_vmq_events", "idx_payment_vmq_events_order_no", "CREATE INDEX idx_payment_vmq_events_order_no ON payment_vmq_events(order_no)");
    }

    private void ensureDefaultVmqPaymentSetting() {
        jdbcTemplate.execute("""
                INSERT INTO payment_vmq_settings (
                    id, enabled, preferred, pay_type, communication_key, amount_strategy, order_timeout_minutes, monitor_state
                )
                SELECT 1, 0, 1, 2, LOWER(MD5(UUID())), 'INCREASE', 5, 'UNBOUND'
                WHERE NOT EXISTS (SELECT 1 FROM payment_vmq_settings WHERE id = 1)
                """);
        jdbcTemplate.execute("UPDATE payment_vmq_settings SET communication_key = LOWER(MD5(UUID())) WHERE id = 1 AND (communication_key IS NULL OR communication_key = '')");
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

    private void ensureHotmailAccountsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS hotmail_accounts (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NOT NULL,
                    email VARCHAR(120) NOT NULL,
                    group_name VARCHAR(80) NULL,
                    sub_emails TEXT NULL,
                    gpt_registered TINYINT(1) NOT NULL DEFAULT 0,
                    gpt_registered_sub_emails TEXT NULL,
                    grok_registered TINYINT(1) NOT NULL DEFAULT 0,
                    grok_registered_sub_emails TEXT NULL,
                    password TEXT NULL,
                    client_id VARCHAR(200) NULL,
                    refresh_token TEXT NOT NULL,
                    access_token TEXT NULL,
                    token_expires_at DATETIME NULL,
                    outlook_access_token TEXT NULL,
                    outlook_token_expires_at DATETIME NULL,
                    imap_access_token TEXT NULL,
                    imap_token_expires_at DATETIME NULL,
                    last_code VARCHAR(50) NULL,
                    last_code_time DATETIME NULL,
                    last_subject VARCHAR(500) NULL,
                    last_sender VARCHAR(255) NULL,
                    last_source VARCHAR(80) NULL,
                    last_folder VARCHAR(255) NULL,
                    last_error VARCHAR(600) NULL,
                    last_fetch_time DATETIME NULL,
                    token_check_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
                    graph_token_ok TINYINT(1) NULL,
                    outlook_token_ok TINYINT(1) NULL,
                    imap_token_ok TINYINT(1) NULL,
                    token_check_summary VARCHAR(600) NULL,
                    token_checked_at DATETIME NULL,
                    public_code_token VARCHAR(80) NULL,
                    public_code_uid VARCHAR(80) NULL,
                    public_code_target_email VARCHAR(120) NULL,
                    public_code_enabled TINYINT(1) NOT NULL DEFAULT 0,
                    public_code_created_at DATETIME NULL,
                    public_code_last_access_time DATETIME NULL,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);
    }

    private void ensureHotmailAccountColumns() {
        ensureColumn("hotmail_accounts", "user_id", "user_id BIGINT NOT NULL DEFAULT 0");
        ensureColumn("hotmail_accounts", "email", "email VARCHAR(120) NOT NULL DEFAULT ''");
        ensureColumn("hotmail_accounts", "group_name", "group_name VARCHAR(80) NULL");
        ensureColumn("hotmail_accounts", "sub_emails", "sub_emails TEXT NULL");
        ensureColumn("hotmail_accounts", "gpt_registered", "gpt_registered TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("hotmail_accounts", "gpt_registered_sub_emails", "gpt_registered_sub_emails TEXT NULL");
        ensureColumn("hotmail_accounts", "grok_registered", "grok_registered TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("hotmail_accounts", "grok_registered_sub_emails", "grok_registered_sub_emails TEXT NULL");
        ensureColumn("hotmail_accounts", "password", "password TEXT NULL");
        ensureHotmailPasswordColumnCapacity();
        ensureColumn("hotmail_accounts", "client_id", "client_id VARCHAR(200) NULL");
        ensureColumn("hotmail_accounts", "refresh_token", "refresh_token TEXT NOT NULL");
        ensureColumn("hotmail_accounts", "access_token", "access_token TEXT NULL");
        ensureColumn("hotmail_accounts", "token_expires_at", "token_expires_at DATETIME NULL");
        ensureColumn("hotmail_accounts", "outlook_access_token", "outlook_access_token TEXT NULL");
        ensureColumn("hotmail_accounts", "outlook_token_expires_at", "outlook_token_expires_at DATETIME NULL");
        ensureColumn("hotmail_accounts", "imap_access_token", "imap_access_token TEXT NULL");
        ensureColumn("hotmail_accounts", "imap_token_expires_at", "imap_token_expires_at DATETIME NULL");
        ensureColumn("hotmail_accounts", "last_code", "last_code VARCHAR(50) NULL");
        ensureColumn("hotmail_accounts", "last_code_time", "last_code_time DATETIME NULL");
        ensureColumn("hotmail_accounts", "last_subject", "last_subject VARCHAR(500) NULL");
        ensureColumn("hotmail_accounts", "last_sender", "last_sender VARCHAR(255) NULL");
        ensureColumn("hotmail_accounts", "last_source", "last_source VARCHAR(80) NULL");
        ensureColumn("hotmail_accounts", "last_folder", "last_folder VARCHAR(255) NULL");
        ensureColumn("hotmail_accounts", "last_error", "last_error VARCHAR(600) NULL");
        ensureColumn("hotmail_accounts", "last_fetch_time", "last_fetch_time DATETIME NULL");
        ensureColumn("hotmail_accounts", "token_check_status", "token_check_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'");
        ensureColumn("hotmail_accounts", "graph_token_ok", "graph_token_ok TINYINT(1) NULL");
        ensureColumn("hotmail_accounts", "outlook_token_ok", "outlook_token_ok TINYINT(1) NULL");
        ensureColumn("hotmail_accounts", "imap_token_ok", "imap_token_ok TINYINT(1) NULL");
        ensureColumn("hotmail_accounts", "token_check_summary", "token_check_summary VARCHAR(600) NULL");
        ensureColumn("hotmail_accounts", "token_checked_at", "token_checked_at DATETIME NULL");
        ensureColumn("hotmail_accounts", "public_code_token", "public_code_token VARCHAR(80) NULL");
        ensureColumn("hotmail_accounts", "public_code_uid", "public_code_uid VARCHAR(80) NULL");
        ensureColumn("hotmail_accounts", "public_code_target_email", "public_code_target_email VARCHAR(120) NULL");
        ensureColumn("hotmail_accounts", "public_code_enabled", "public_code_enabled TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("hotmail_accounts", "public_code_created_at", "public_code_created_at DATETIME NULL");
        ensureColumn("hotmail_accounts", "public_code_last_access_time", "public_code_last_access_time DATETIME NULL");
        jdbcTemplate.execute("UPDATE hotmail_accounts SET public_code_enabled = 0 WHERE public_code_enabled IS NULL");
        jdbcTemplate.execute("UPDATE hotmail_accounts SET gpt_registered = 0 WHERE gpt_registered IS NULL");
        jdbcTemplate.execute("UPDATE hotmail_accounts SET grok_registered = 0 WHERE grok_registered IS NULL");
        jdbcTemplate.execute("UPDATE hotmail_accounts SET token_check_status = 'UNKNOWN' WHERE token_check_status IS NULL OR token_check_status = ''");
        ensureIndex("hotmail_accounts", "idx_hotmail_accounts_user_id", "CREATE INDEX idx_hotmail_accounts_user_id ON hotmail_accounts(user_id)");
        ensureIndex("hotmail_accounts", "idx_hotmail_accounts_email", "CREATE INDEX idx_hotmail_accounts_email ON hotmail_accounts(email)");
        ensureIndex("hotmail_accounts", "idx_hotmail_accounts_group_name", "CREATE INDEX idx_hotmail_accounts_group_name ON hotmail_accounts(group_name)");
        ensureIndex("hotmail_accounts", "idx_hotmail_accounts_token_check_status", "CREATE INDEX idx_hotmail_accounts_token_check_status ON hotmail_accounts(token_check_status)");
        ensureHotmailPublicCodeTokenUniqueIndex();
    }

    private void normalizeHotmailAccounts() {
        if (!tableExists("hotmail_accounts")) {
            return;
        }

        jdbcTemplate.update("UPDATE hotmail_accounts SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))");
        jdbcTemplate.update("UPDATE hotmail_accounts SET gpt_registered = 0 WHERE gpt_registered IS NULL");
        jdbcTemplate.update("UPDATE hotmail_accounts SET grok_registered = 0 WHERE grok_registered IS NULL");
        jdbcTemplate.update(
                """
                DELETE older
                FROM hotmail_accounts older
                INNER JOIN hotmail_accounts newer
                    ON older.user_id = newer.user_id
                    AND older.email = newer.email
                    AND older.id < newer.id
                """
        );

        List<Map<String, Object>> accounts = jdbcTemplate.queryForList(
                "SELECT id, password, refresh_token, access_token, outlook_access_token, imap_access_token FROM hotmail_accounts"
        );

        for (Map<String, Object> account : accounts) {
            Long id = ((Number) account.get("id")).longValue();
            String password = (String) account.get("password");
            String refreshToken = (String) account.get("refresh_token");
            String accessToken = (String) account.get("access_token");
            String outlookAccessToken = (String) account.get("outlook_access_token");
            String imapAccessToken = (String) account.get("imap_access_token");

            String encryptedPassword = encryptIfNeeded(password);
            String encryptedRefreshToken = encryptIfNeeded(refreshToken);
            String encryptedAccessToken = encryptIfNeeded(accessToken);
            String encryptedOutlookAccessToken = encryptIfNeeded(outlookAccessToken);
            String encryptedImapAccessToken = encryptIfNeeded(imapAccessToken);

            if (!equalsNullable(password, encryptedPassword)
                    || !equalsNullable(refreshToken, encryptedRefreshToken)
                    || !equalsNullable(accessToken, encryptedAccessToken)
                    || !equalsNullable(outlookAccessToken, encryptedOutlookAccessToken)
                    || !equalsNullable(imapAccessToken, encryptedImapAccessToken)) {
                jdbcTemplate.update(
                        "UPDATE hotmail_accounts SET password = ?, refresh_token = ?, access_token = ?, outlook_access_token = ?, imap_access_token = ? WHERE id = ?",
                        encryptedPassword,
                        encryptedRefreshToken,
                        encryptedAccessToken,
                        encryptedOutlookAccessToken,
                        encryptedImapAccessToken,
                        id
                );
            }
        }

        ensureIndex("hotmail_accounts", "uk_hotmail_accounts_user_email", "CREATE UNIQUE INDEX uk_hotmail_accounts_user_email ON hotmail_accounts(user_id, email)");
    }

    private void ensureHotmailPasswordColumnCapacity() {
        if (!tableExists("hotmail_accounts")) {
            return;
        }

        String dataType = jdbcTemplate.queryForObject(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotmail_accounts' AND COLUMN_NAME = 'password'",
                String.class
        );
        if (dataType != null && !dataType.toLowerCase().contains("text")) {
            jdbcTemplate.execute("ALTER TABLE hotmail_accounts MODIFY COLUMN password TEXT NULL");
        }
    }

    private void ensureHotmailPublicCodeTokenUniqueIndex() {
        if (!tableExists("hotmail_accounts")) {
            return;
        }

        jdbcTemplate.update("""
                UPDATE hotmail_accounts
                SET public_code_token = NULL,
                    public_code_uid = NULL,
                    public_code_enabled = 0,
                    public_code_target_email = NULL,
                    public_code_created_at = NULL,
                    public_code_last_access_time = NULL
                WHERE public_code_token = ''
                    OR public_code_uid = ''
                    OR (public_code_token IS NULL AND (public_code_enabled = 1 OR public_code_uid IS NOT NULL))
                    OR (public_code_uid IS NULL AND public_code_token IS NOT NULL)
                """);
        jdbcTemplate.update("""
                UPDATE hotmail_accounts older
                INNER JOIN hotmail_accounts newer
                    ON older.public_code_token = newer.public_code_token
                    AND older.id < newer.id
                SET older.public_code_token = NULL,
                    older.public_code_uid = NULL,
                    older.public_code_enabled = 0,
                    older.public_code_target_email = NULL,
                    older.public_code_created_at = NULL,
                    older.public_code_last_access_time = NULL
                WHERE older.public_code_token IS NOT NULL
                    AND older.public_code_token <> ''
                """);
        jdbcTemplate.update("""
                UPDATE hotmail_accounts older
                INNER JOIN hotmail_accounts newer
                    ON older.public_code_uid = newer.public_code_uid
                    AND older.id < newer.id
                SET older.public_code_uid = NULL
                WHERE older.public_code_uid IS NOT NULL
                    AND older.public_code_uid <> ''
                """);

        if (indexExists("hotmail_accounts", "idx_hotmail_accounts_public_code_token")) {
            jdbcTemplate.execute("ALTER TABLE hotmail_accounts DROP INDEX idx_hotmail_accounts_public_code_token");
        }
        ensureIndex(
                "hotmail_accounts",
                "uk_hotmail_accounts_public_code_token",
                "CREATE UNIQUE INDEX uk_hotmail_accounts_public_code_token ON hotmail_accounts(public_code_token)"
        );
        ensureIndex(
                "hotmail_accounts",
                "uk_hotmail_accounts_public_code_uid",
                "CREATE UNIQUE INDEX uk_hotmail_accounts_public_code_uid ON hotmail_accounts(public_code_uid)"
        );
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

    private void ensureDefaultForumBoards() {
        jdbcTemplate.batchUpdate(
                """
                INSERT INTO forum_boards (name, description, sort_order, active)
                SELECT ?, ?, ?, 1
                FROM DUAL
                WHERE NOT EXISTS (
                    SELECT 1 FROM forum_boards WHERE name = ?
                )
                """,
                java.util.List.of(
                        new Object[]{"综合讨论", "日常交流和主题讨论", 1, "综合讨论"},
                        new Object[]{"求助答疑", "提问、排查和经验互助", 2, "求助答疑"},
                        new Object[]{"下载反馈", "下载资源、安装和版本反馈", 3, "下载反馈"},
                        new Object[]{"建议反馈", "产品建议和体验优化", 4, "建议反馈"},
                        new Object[]{"问题反馈", "问题报告和异常反馈", 5, "问题反馈"}
                )
        );
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

    private void ensureTextColumn(String tableName, String columnName) {
        String dataType = jdbcTemplate.queryForObject(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                String.class,
                tableName,
                columnName
        );
        if (dataType != null && !dataType.toLowerCase().contains("text")) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " MODIFY COLUMN " + columnName + " TEXT NOT NULL");
        }
    }

    private void ensureIndex(String tableName, String indexName, String createSql) {
        if (!indexExists(tableName, indexName)) {
            jdbcTemplate.execute(createSql);
        }
    }

    private boolean indexExists(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
                Integer.class,
                tableName,
                indexName
        );

        return count != null && count > 0;
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private String encryptIfNeeded(String value) {
        if (value == null || value.isBlank() || hotmailCredentialCrypto.isEncrypted(value)) {
            return value;
        }
        return hotmailCredentialCrypto.encrypt(value);
    }

    private boolean equalsNullable(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }
}
