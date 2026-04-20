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

CREATE TABLE IF NOT EXISTS quant_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(10,2) NOT NULL,
    high DECIMAL(10,2) NOT NULL,
    low DECIMAL(10,2) NOT NULL,
    close DECIMAL(10,2) NOT NULL,
    volume BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    indicator1 DECIMAL(10,4) NULL,
    indicator2 DECIMAL(10,4) NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_quant_symbol_date (symbol, date)
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
    content VARCHAR(1000) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_private_chat_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_private_chat_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

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
    category VARCHAR(40) NULL,
    file_size VARCHAR(40) NULL,
    checksum_sha256 VARCHAR(128) NULL,
    download_count INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
