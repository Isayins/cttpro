CREATE DATABASE IF NOT EXISTS idncar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE idncar;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    author VARCHAR(50) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS replies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    author VARCHAR(50) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    UNIQUE KEY unique_symbol_date (symbol, date)
);

INSERT INTO users (username, password, nickname, role) VALUES
('admin', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '管理员', 'ADMIN'),
('user1', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '用户1', 'USER');

INSERT INTO posts (title, content, user_id, author, view_count, like_count) VALUES
('欢迎来到论坛', '这是论坛的第一条帖子，欢迎大家积极参与讨论。', 1, '管理员', 10, 5),
('技术分享：Spring Boot 3.0 新特性', 'Spring Boot 3.0 带来了很多新特性，包括 Java 17 支持、原生镜像支持等。', 1, '管理员', 15, 8),
('求助：Docker 部署问题', '我在部署 Docker 容器时遇到了端口映射问题，有人能帮忙解答吗？', 2, '用户1', 8, 2);

INSERT INTO replies (post_id, content, user_id, author) VALUES
(1, '支持，希望论坛越办越好。', 2, '用户1'),
(2, '感谢分享，学到了。', 2, '用户1'),
(3, '你可以先检查一下端口是否被占用。', 1, '管理员');
