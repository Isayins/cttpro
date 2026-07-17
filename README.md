# cttpro

cttpro 是一个前后端一体的业务项目，包含 React 前台和 Spring Boot API 服务。当前功能覆盖官网内容、论坛、下载资源、商品与支付宝当面付订单、后台运营管理、二维码和邮件验证码等模块。

## 项目结构

```text
.
├── src/                 # React + TypeScript 前端
├── java-backend/        # Spring Boot 3 后端 API
├── public/              # 前端静态资源
├── .github/workflows/   # GitHub Actions 部署流程
└── docker-compose.yml   # 本地/服务器容器编排
```

## 前端

```bash
cp .env.example .env
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

常用环境变量：

```bash
VITE_API_BASE_URL=http://localhost:9091
VITE_API_TIMEOUT_MS=15000
VITE_IDLE_LOGOUT_MINUTES=120
```

## Java 后端

后端基于 Spring Boot 3、Java 17、MyBatis Plus、MySQL、Redis 和 JWT。

```bash
cd java-backend
cp .env.example .env
./mvnw test
./mvnw spring-boot:run
```

Windows PowerShell 下将 `./mvnw` 换成 `.\mvnw.cmd`。

主要环境变量：

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/idncar?serverTimezone=Asia/Shanghai
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=change-me
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
JWT_SECRET=
```

`JWT_SECRET` 必须配置为至少 32 字节随机数据的 Base64 编码；本地 Compose 只监听 `127.0.0.1`，不会把数据库和 Redis 暴露到局域网。

支付相关配置支持官方支付宝和内置 V免签两种通道。官方支付宝通过 `APP_PAYMENT_ALIPAY_*` 注入；接口内容加密默认开启，需要在支付宝开放平台配置 AES 接口内容加密，并将密钥填入 `APP_PAYMENT_ALIPAY_ENCRYPT_KEY`。V免签不需要单独部署 PHP 后台，启动后进入后台管理的「V免签配置」，系统会自动生成通讯密钥；保存收款码内容并启用后，监听端使用站点根路径的 `/getState`、`/appHeart`、`/appPush` 接口和后台显示的通讯密钥即可推送收款。生产环境不要使用仓库中的示例默认值。

V免签使用“精确实付金额”区分同时创建的订单：当同一通道存在相同待支付金额时，系统会自动按配置把新订单调整为加/减几分钱的唯一金额。用户必须按页面展示的精确金额支付；如果监听端上报金额同时命中多笔订单，系统不会自动确认，需进入后台人工核实。

创建支付订单后，后端会默认发送一封人工确认收款提醒邮件；收件人可通过 `APP_PAYMENT_MANUAL_CONFIRM_RECIPIENTS` 指定多个邮箱（逗号分隔），未配置时会尝试发送给后台 OWNER/ADMIN 账号邮箱。管理员需要登录后台进入「支付订单」并点击“人工确认”，系统才会把订单同步为已支付并触发发货/优惠码等后续流程；可用 `APP_PAYMENT_MANUAL_CONFIRM_ENABLED=false` 关闭这类提醒。

## 后台运营功能

- 后台「系统状态」会集中检查邮件发送、V免签支付、异常订单、商品发货库存和下载中心资源，给出正常/关注/异常状态和跳转处理入口。
- 聊天室和「随便聊聊」统一使用当前登录账号身份；社区写操作必须登录，清空聊天室仅管理员可执行。
- 登录页支持通过注册邮箱验证码重置密码；重置成功后会使该账号当前登录会话失效。
- 后台涉及新增功能、页面或用户可见流程时，需要同步更新相关 Markdown 说明，并在交付前提交 Git。

## Docker

```bash
docker compose config
docker compose up --build
```

Ubuntu 服务器一键部署：

```bash
bash deploy/ubuntu/deploy.sh
```

详细说明见 `deploy/ubuntu/README.md`。

默认服务端口：

- 前端本地开发：`5173`
- Java 后端：`9091`
- MySQL：`3306`
- Redis：`6379`

Compose 已配置 MySQL、Redis 和 Java 后端健康检查；Java 后端会等待依赖服务健康后再启动。

## 验证清单

提交或部署前建议至少执行：

```bash
npm run check:all
```

也可以单独验证 Java 后端：

```bash
cd java-backend
cp .env.example .env
./mvnw test
```

如果需要验证网页功能，直接新建一个账户并登录后进行验证即可。

## 注意事项

- `artifacts/`、`dist/`、`screenshots/`、`java-backend/uploads/`、`*.tsbuildinfo` 属于生成物或运行时数据，不应提交。
- 生产密钥、数据库密码、Redis 密码、邮箱授权码、支付宝私钥和支付宝接口内容加密密钥都应通过环境变量或密钥管理系统注入。
- GitHub Actions 流程位于 `.github/workflows/deploy.yml`：PR 会校验前端和 Java 后端，`main` 分支校验通过后才上传 Vite 的 `dist/*` 到服务器目录。
