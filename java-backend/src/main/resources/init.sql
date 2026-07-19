CREATE DATABASE IF NOT EXISTS mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mail;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(120) NULL,
    password VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    avatar_url VARCHAR(255) NULL,
    bio TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    chat_visibility VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)
);

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(40) NULL,
    tags VARCHAR(255) NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    favorite_count INT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL,
    author VARCHAR(50) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS forum_boards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(40) NOT NULL,
    description VARCHAR(200) NULL,
    avatar_url VARCHAR(500) NULL,
    owner_user_id BIGINT NULL,
    level_title_config TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_forum_boards_name (name),
    KEY idx_forum_boards_active_sort (active, sort_order),
    KEY idx_forum_boards_owner_user_id (owner_user_id)
);

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
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_forum_board_owner_applications_board_status (board_id, status),
    KEY idx_forum_board_owner_applications_applicant_status (applicant_id, status),
    KEY idx_forum_board_owner_applications_board_applicant_status (board_id, applicant_id, status),
    KEY idx_forum_board_owner_applications_status_time (status, create_time)
);

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
);

CREATE TABLE IF NOT EXISTS replies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    author VARCHAR(50) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_replies_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_replies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invite_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    created_by BIGINT NOT NULL,
    used_by BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_reusable TINYINT(1) NOT NULL DEFAULT 0,
    usage_count INT NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    used_at DATETIME NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_invite_codes_code (code)
);

CREATE TABLE IF NOT EXISTS login_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    login_identity VARCHAR(120) NOT NULL,
    ip_address VARCHAR(120) NULL,
    user_agent VARCHAR(500) NULL,
    device_type VARCHAR(30) NULL,
    login_status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_likes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_post_likes_post_user (post_id, user_id),
    CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_favorites (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_post_favorites_post_user (post_id, user_id),
    CONSTRAINT fk_post_favorites_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_post_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS community_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id VARCHAR(32) NOT NULL,
    author VARCHAR(40) NOT NULL,
    avatar_seed VARCHAR(60) NULL,
    content TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS private_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sender_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    read_at DATETIME NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_private_chat_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_private_chat_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_talk_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id BIGINT NULL,
    author VARCHAR(40) NOT NULL,
    avatar_seed VARCHAR(60) NULL,
    content TEXT NOT NULL,
    category VARCHAR(40) NULL,
    likes INT NOT NULL DEFAULT 0,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_community_talk_posts_author_id (author_id)
);

CREATE TABLE IF NOT EXISTS community_talk_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    author VARCHAR(40) NOT NULL,
    content VARCHAR(300) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS download_resources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    version VARCHAR(50) NULL,
    changelog TEXT NULL,
    url VARCHAR(500) NOT NULL,
    icon VARCHAR(255) NULL,
    locked TINYINT(1) NOT NULL DEFAULT 0,
    download_password_hash VARCHAR(100) NULL,
    category VARCHAR(40) NULL,
    file_size VARCHAR(40) NULL,
    checksum_sha256 VARCHAR(128) NULL,
    download_count INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    subtitle VARCHAR(180) NULL,
    description TEXT NULL,
    image_url VARCHAR(500) NULL,
    price DECIMAL(12,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    sales_count INT NOT NULL DEFAULT 0,
    delivery_type VARCHAR(30) NOT NULL DEFAULT 'NONE',
    delivery_instructions TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    sort_order INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_products_status_sort_order (status, sort_order),
    KEY idx_products_update_time (update_time)
);

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
    UNIQUE KEY uk_product_delivery_codes_product_code (product_id, code),
    KEY idx_product_delivery_codes_product_status (product_id, status),
    KEY idx_product_delivery_codes_batch_no (batch_no),
    KEY idx_product_delivery_codes_order_no (order_no)
);

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
    UNIQUE KEY uk_product_coupon_codes_code (code),
    KEY idx_product_coupon_codes_product_status (product_id, status),
    KEY idx_product_coupon_codes_status_expires (status, expires_at),
    KEY idx_product_coupon_codes_batch_no (batch_no),
    KEY idx_product_coupon_codes_lock_order_no (lock_order_no)
);

CREATE TABLE IF NOT EXISTS payment_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    channel VARCHAR(30) NOT NULL DEFAULT 'ALIPAY_F2F',
    out_trade_no VARCHAR(64) NOT NULL,
    trade_no VARCHAR(64) NULL,
    buyer_logon_id VARCHAR(120) NULL,
    subject VARCHAR(256) NOT NULL,
    body VARCHAR(500) NULL,
    original_amount DECIMAL(12,2) NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    coupon_code VARCHAR(32) NULL,
    coupon_code_id BIGINT NULL,
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
    UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no),
    KEY idx_payment_orders_payer_user_id (payer_user_id),
    KEY idx_payment_orders_status (status),
    KEY idx_payment_orders_create_time (create_time),
    KEY idx_payment_orders_coupon_code_id (coupon_code_id)
);

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
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_mail_send_logs_create_time (create_time),
    KEY idx_mail_send_logs_order_no (order_no),
    KEY idx_mail_send_logs_status (status),
    KEY idx_mail_send_logs_recipient_email (recipient_email)
);

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
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS site_notices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    content TEXT NOT NULL,
    published TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
);

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
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
    title VARCHAR(120) NOT NULL,
    content VARCHAR(500) NOT NULL,
    related_path VARCHAR(255) NULL,
    read_status TINYINT(1) NOT NULL DEFAULT 0,
    read_time DATETIME NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_hotmail_accounts_user_email (user_id, email),
    UNIQUE KEY uk_hotmail_accounts_public_code_token (public_code_token),
    UNIQUE KEY uk_hotmail_accounts_public_code_uid (public_code_uid),
    KEY idx_hotmail_accounts_user_id (user_id),
    KEY idx_hotmail_accounts_email (email),
    KEY idx_hotmail_accounts_group_name (group_name),
    KEY idx_hotmail_accounts_token_check_status (token_check_status)
);

INSERT INTO users (username, email, password, nickname, role, avatar_url, bio, status)
SELECT
    'admin',
    'admin@idncar.local',
    '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'Administrator',
    'OWNER',
    'https://api.dicebear.com/9.x/initials/svg?seed=Admin',
    'Default admin account',
    'ACTIVE'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'admin'
);

INSERT INTO users (username, email, password, nickname, role, avatar_url, bio, status)
SELECT
    'user1',
    'user1@idncar.local',
    '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'User 1',
    'USER',
    'https://api.dicebear.com/9.x/initials/svg?seed=User1',
    'Default sample user',
    'ACTIVE'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'user1'
);

INSERT INTO invite_codes (code, created_by, status, is_reusable, usage_count, expires_at)
SELECT
    'IDNCAR2026',
    COALESCE((SELECT id FROM users WHERE role IN ('OWNER', 'ADMIN') ORDER BY CASE WHEN role = 'OWNER' THEN 0 ELSE 1 END, id LIMIT 1), 1),
    'ACTIVE',
    1,
    0,
    DATE_ADD(NOW(), INTERVAL 3650 DAY)
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM invite_codes WHERE code = 'IDNCAR2026'
);

UPDATE invite_codes
SET
    status = 'ACTIVE',
    is_reusable = 1,
    usage_count = COALESCE(usage_count, 0),
    used_by = NULL,
    used_at = NULL,
    expires_at = COALESCE(expires_at, DATE_ADD(NOW(), INTERVAL 3650 DAY))
WHERE code = 'IDNCAR2026';

INSERT INTO payment_vmq_settings (
    id, enabled, preferred, pay_type, communication_key, amount_strategy, order_timeout_minutes, monitor_state
)
SELECT 1, 0, 1, 2, LOWER(MD5(UUID())), 'INCREASE', 5, 'UNBOUND'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM payment_vmq_settings WHERE id = 1
);

INSERT INTO download_resources (title, version, changelog, url, icon, locked, sort_order)
SELECT
    'IDNCAR Windows Client',
    'v1.0.0',
    'Initial release package.',
    'https://idncar.com/downloads/idncar-win.zip',
    'https://idncar.com/images/idncar.jpg',
    0,
    1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM download_resources WHERE url = 'https://idncar.com/downloads/idncar-win.zip'
);

INSERT INTO site_notices (title, content, published, sort_order)
SELECT
    '新用户注册说明',
    '注册账号需要邀请码和邮箱验证码，如需开通请先联系管理员获取邀请码。',
    1,
    1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM site_notices
);

INSERT INTO site_notices (title, content, published, sort_order)
SELECT
    '下载中心提示',
    '下载中心会持续更新客户端和相关资源，请优先查看版本号和更新说明后再下载。',
    1,
    2
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM site_notices WHERE sort_order = 2
);

INSERT INTO site_notices (title, content, published, sort_order)
SELECT
    '社区交流提醒',
    '完善昵称、头像和个人简介后，论坛内的发帖与回复会同步展示你的最新资料。',
    1,
    3
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM site_notices WHERE sort_order = 3
);

INSERT INTO forum_boards (name, description, sort_order, active)
SELECT '综合讨论', '日常交流和主题讨论', 1, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM forum_boards WHERE name = '综合讨论'
);

INSERT INTO forum_boards (name, description, sort_order, active)
SELECT '求助答疑', '提问、排查和经验互助', 2, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM forum_boards WHERE name = '求助答疑'
);

INSERT INTO forum_boards (name, description, sort_order, active)
SELECT '下载反馈', '下载资源、安装和版本反馈', 3, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM forum_boards WHERE name = '下载反馈'
);

INSERT INTO forum_boards (name, description, sort_order, active)
SELECT '建议反馈', '产品建议和体验优化', 4, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM forum_boards WHERE name = '建议反馈'
);

INSERT INTO forum_boards (name, description, sort_order, active)
SELECT '问题反馈', '问题报告和异常反馈', 5, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM forum_boards WHERE name = '问题反馈'
);
