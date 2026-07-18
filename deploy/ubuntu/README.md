# Ubuntu 部署

当前生产环境采用宿主机 Nginx、systemd Java、MySQL 和 Redis。Docker 文件仅保留为可选部署方式。

## 宿主机持续部署

首次接入持续部署前，确认 `/opt/cttpro/.env` 已配置，并让 systemd 固定从
`/opt/cttpro/java-backend.jar` 启动。已有 JAR 可以先建立软链接，再安装服务：

```bash
ln -sfn /opt/cttpro/现有后端.jar /opt/cttpro/java-backend.jar
sudo SERVICE_USER=cttpro bash deploy/ubuntu/install-backend-service.sh
```

GitHub Actions 在 `main` 检查通过后会上传同一版本的前端和后端，并执行
`deploy-host-release.sh`。脚本先切换后端，等待 `/actuator/health` 返回 `UP`，
再切换前端和重载 Nginx；任一步失败会恢复上一版本。发布成功后还会同步
`/opt/cttpro/deploy/ubuntu` 和已安装的备份、健康检查运行脚本。

需要手动回滚最近一次发布时执行：

```bash
sudo bash deploy/ubuntu/deploy-host-release.sh --rollback
```

流水线需要配置 `SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY` 和
`SERVER_SSH_PASSPHRASE`；部署账号必须能够写入 `/opt/cttpro`、
`/var/www/html/cttpro`，并执行 `systemctl` 与 `nginx -t`。

## Docker 可选部署

Docker 方案包含：

- `frontend`：Nginx 静态站点，反代 `/api/` 和 WebSocket 到 Java 后端
- `java-backend`：Spring Boot API
- `mysql`：MySQL 8
- `redis`：Redis 7

### 首次部署

在服务器上进入项目根目录：

```bash
bash deploy/ubuntu/deploy.sh
```

脚本会自动：

- 创建 `deploy/ubuntu/.env`
- 为 MySQL、JWT、Hotmail 加密生成随机生产密钥
- 检测并安装 Docker Engine / Docker Compose Plugin
- 构建前端和 Java 后端镜像
- 启动全部服务并显示状态

部署完成后访问：

```text
http://服务器IP
```

### 配置

首次运行后可编辑：

```bash
nano deploy/ubuntu/.env
```

常用项：

```bash
HTTP_PORT=80
MYSQL_DATABASE=idncar
APP_PAYMENT_ALIPAY_ENABLED=false
APP_PAYMENT_ALIPAY_APP_ID=
APP_PAYMENT_ALIPAY_PRIVATE_KEY=
APP_PAYMENT_ALIPAY_ALIPAY_PUBLIC_KEY=
APP_PAYMENT_ALIPAY_NOTIFY_URL=
```

如使用 V免签，不需要单独部署 PHP 后台。部署完成后进入后台管理的「V免签配置」启用通道、保存收款码内容，并把后台显示的通讯密钥填到监听端。

改完配置后重新执行：

```bash
bash deploy/ubuntu/deploy.sh
```

### 维护命令

查看状态：

```bash
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/docker-compose.yml ps
```

查看日志：

```bash
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/docker-compose.yml logs -f
```

停止服务：

```bash
docker compose --env-file deploy/ubuntu/.env -f deploy/ubuntu/docker-compose.yml down
```

保留数据库和上传文件的持久化卷；如需清空数据，需额外删除 Docker volumes。

## 宿主机数据备份与恢复

以下脚本用于宿主机部署，不依赖 Docker。它读取 `/opt/cttpro/.env` 中的
`SPRING_DATASOURCE_*` 和 `APP_UPLOAD_BASE_DIR`，需要宿主机已安装
`default-mysql-client`、`redis-tools`、`tar` 和 `gzip`；启用异机同步时还需
`rsync` 和可免交互登录的 SSH 密钥。

备份运行中的 MySQL 和上传文件，默认写入 `/opt/cttpro/backups/<时间>/`，
并生成 SHA-256 校验文件；默认删除超过 14 天的备份：

```bash
bash deploy/ubuntu/backup.sh
```

可通过环境变量调整位置和保留天数：

```bash
BACKUP_ROOT=/srv/cttpro-backups BACKUP_RETENTION_DAYS=30 \
  bash deploy/ubuntu/backup.sh
```

本机备份仍可能随磁盘一起丢失。推荐在 `/opt/cttpro/.env` 配置独立服务器：

```bash
BACKUP_REMOTE_TARGET=backup@example.com:/srv/cttpro
APP_OPS_ALERT_WEBHOOK_URL=https://alerts.example.com/cttpro
```

备份完成后会通过 SSH/rsync 同步到远端，并将结果写入
`/opt/cttpro/backup-status.properties`；后台「系统状态」会显示备份是否失败、
是否超过 36 小时及是否完成异机同步。Webhook 接收标准 JSON `{"text":"..."}`。

安装宿主机定时器后，每天凌晨 3 点备份、每 5 分钟检查后端健康状态；健康告警
只在正常/故障状态变化时发送：

```bash
sudo bash deploy/ubuntu/install-ops-timers.sh
systemctl list-timers 'cttpro-*'
journalctl -u cttpro-backup.service -u cttpro-health.service
```

如不使用 systemd timer，也可以使用 cron：

```cron
0 3 * * * BACKUP_ROOT=/srv/cttpro-backups BACKUP_RETENTION_DAYS=30 /bin/bash /opt/cttpro/deploy/ubuntu/backup.sh >> /var/log/cttpro-backup.log 2>&1
```

恢复会校验归档、停止 Java 后端、重建数据库与上传目录、清理 Redis 会话，
必须显式确认。默认通过 systemd 管理 `java-backend` 服务；nohup 部署设置
`APP_CONTROL=nohup`。失败时后端保持停止，先检查数据后再手动启动：

```bash
RESTORE_CONFIRM=RESTORE \
  bash deploy/ubuntu/restore.sh /srv/cttpro-backups/20260718-030000

APP_CONTROL=nohup RESTORE_CONFIRM=RESTORE \
  bash deploy/ubuntu/restore.sh /srv/cttpro-backups/20260718-030000
```

## 宿主机 Nohup 单独启动 Java 后端

如果只部署 Java 后端 JAR，可以使用：

```bash
bash deploy/ubuntu/java-backend-nohup.sh start
bash deploy/ubuntu/java-backend-nohup.sh status
bash deploy/ubuntu/java-backend-nohup.sh logs
bash deploy/ubuntu/java-backend-nohup.sh stop
```

默认从 `/opt/cttpro` 或 `/opt/cttpro/artifacts` 自动选择最新的 `java-backend-*.jar`。也可以显式指定：

```bash
APP_HOME=/opt/cttpro \
JAR=/opt/cttpro/java-backend-1.0.0-20260704-083016.jar \
bash deploy/ubuntu/java-backend-nohup.sh start
```

## 非 Docker Nginx

当前生产机采用宿主机 Nginx、systemd Java 服务时，使用
`deploy/ubuntu/nginx-host.conf`。该配置对应以下目录和端口：

- 前端：`/var/www/html/cttpro/dist`
- Java 后端：`127.0.0.1:9091`
- 验证码服务：`127.0.0.1:8524`
- 远程服务：`127.0.0.1:8080`

配置中的 `/api/` 和 `/uploads/` 使用 `^~` 前缀，避免 JPG、PNG 等静态
文件正则抢占上传文件请求；同时兼容数据库中历史 `/uploads/` 地址。
公开认证接口使用 Nginx 原生限流：登录、注册和密码重置每 IP 每分钟 10 次，
邮箱验证码发送每 IP 每分钟 5 次；超限返回 HTTP 429，其他 API 不计入该限流。

更新生产配置时应先备份原文件，使用 `nginx -t` 校验成功后再执行
`systemctl reload nginx`。不要使用全局 `error_page 404 /index.html`，SPA
回退已由主站 `location /` 内的 `try_files` 处理。

仓库提供了原子安装脚本，会自动定位站点配置、备份、校验并在失败时回滚。
当前生产机实际加载 `/etc/nginx/conf.d/videos.conf`，建议显式传入该路径，避免
同域名的 `sites-enabled` 旧配置被误选：

```bash
sudo AVATAR_FILE=user-7-01c37cd8ab9a4504944b8b7518788da5.jpg \
  bash deploy/ubuntu/install-nginx-host.sh /etc/nginx/conf.d/videos.conf
```

如自动定位到的不是目标站点，可把实际配置路径作为第一个参数传入。脚本只有在
`nginx -t` 成功后才会 reload，并会同时验证新 `/api/uploads/` 和历史
`/uploads/` 头像地址。
