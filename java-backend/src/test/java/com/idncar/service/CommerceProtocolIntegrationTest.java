package com.idncar.service;

import com.alipay.api.internal.util.AlipaySignature;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.api.payment.AlipayPaymentController;
import com.idncar.config.AlipayPaymentProperties;
import com.idncar.config.DatabaseSchemaInitializer;
import com.idncar.exception.ApiException;
import com.idncar.mapper.MailSendLogMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.mapper.UserNotificationMapper;
import com.idncar.model.entity.MailSendLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductDeliveryCode;
import com.idncar.model.entity.User;
import com.idncar.model.entity.UserNotification;
import com.idncar.service.impl.MailBrandTemplateHelper;
import com.idncar.support.LoopbackSmtpServer;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServer;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.util.HtmlUtils;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Explicit opt-in: -Dcommerce.protocol.test.enabled=true
 * -Dcommerce.protocol.test.manifest=<disposable fixture manifest>.
 * Uses original MVC/services/mappers and real loopback HTTP, MySQL and SMTP. No production
 * configuration is loaded. This does not validate Alipay, public TLS, SMTP auth or inbox delivery.
 */
@EnabledIfSystemProperty(named = "commerce.protocol.test.enabled", matches = "true")
class CommerceProtocolIntegrationTest {
    private static final String DATABASE = "cttpro_commerce_protocol_test_"
            + UUID.randomUUID().toString().replace("-", "");
    private static final String APP_ID = "2026101500000001";
    private static final String BUYER_EMAIL = "buyer@commerce.invalid";
    private static final String DELIVERY_ACCOUNT = "fixture-mailbox@delivery.invalid";
    private static final String DELIVERY_URL = "https://delivery.invalid/api/code/fetch"
            + "?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&uid=bbbbbbbbbbbbbbbbbbbb";
    private static final String DELIVERY_CODE = DELIVERY_ACCOUNT + "----" + DELIVERY_URL;
    private static final String MISSING_CONTENT_ERROR = "商品尚未配置交付内容，请联系管理员处理";
    private static JdbcTemplate admin;
    private static JdbcTemplate jdbc;
    private static SqlSessionTemplate sql;
    private static DataSourceTransactionManager transactions;
    private static String privateKey;
    private static String publicKey;
    private static boolean databaseCreated;
    private LoopbackSmtpServer smtp;
    private WebServer http;
    private AnnotationConfigWebApplicationContext context;
    private ProductDeliveryCodeService delivery;
    private PaymentOrderMapper orders;
    private ProductMapper products;
    private ProductDeliveryCodeMapper codes;
    private MailSendLogMapper mailLogs;
    private Long buyerId;

    @BeforeAll
    static void initializeDatabase() throws Exception {
        Path manifestPath = Path.of(System.getProperty("commerce.protocol.test.manifest", ""));
        assertThat(Files.isRegularFile(manifestPath)).as("An explicit isolated fixture manifest is required").isTrue();
        JsonNode manifest = new ObjectMapper().readTree(manifestPath.toFile());
        assertThat(manifest.path("purpose").asText()).isEqualTo("remaining-boundaries-authorization");
        int port = manifest.path("mysqlPort").asInt();
        assertThat(port).isBetween(1024, 65535).isNotIn(3306, 33060);
        Path fixtureRoot = Path.of(manifest.path("fixtureRoot").asText()).toRealPath();
        Path dataDir = Path.of(manifest.path("mysqlDataDir").asText()).toRealPath();
        assertThat(dataDir.startsWith(fixtureRoot) && !dataDir.equals(fixtureRoot))
                .as("MySQL data must belong to the disposable fixture").isTrue();
        ProcessHandle process = ProcessHandle.of(manifest.path("mysqlPid").asLong()).orElseThrow();
        assertThat(process.isAlive()).isTrue();
        String executable = Path.of(process.info().command().orElseThrow()).getFileName().toString();
        assertThat(executable).isIn("mysqld", "mysqld.exe");
        Instant expectedStart = Instant.parse(manifest.path("mysqlStartedAt").asText());
        assertThat(Duration.between(expectedStart, process.info().startInstant().orElseThrow()).abs())
                .isLessThan(Duration.ofSeconds(2));

        // Passwordless root is supported only for this separately initialized loopback fixture.
        String base = "jdbc:mysql://127.0.0.1:" + port + "/";
        String options = "?useSSL=false&allowPublicKeyRetrieval=true&connectTimeout=3000&socketTimeout=10000";
        JdbcTemplate candidate = new JdbcTemplate(new DriverManagerDataSource(base + options, "root", ""));
        assertThat(candidate.queryForObject("SELECT @@port", Integer.class)).isEqualTo(port);
        assertThat(candidate.queryForObject("SELECT @@bind_address", String.class)).isEqualTo("127.0.0.1");
        Path actualData = Path.of(candidate.queryForObject("SELECT @@datadir", String.class)).toRealPath();
        assertThat(Files.isSameFile(dataDir, actualData)).isTrue();
        Path pidFile = Path.of(candidate.queryForObject("SELECT @@pid_file", String.class));
        assertThat(Long.parseLong(Files.readString(pidFile).trim())).isEqualTo(process.pid());
        admin = candidate;
        admin.execute("CREATE DATABASE " + DATABASE);
        databaseCreated = true;
        DriverManagerDataSource dataSource = new DriverManagerDataSource(base + DATABASE + options, "root", "");
        jdbc = new JdbcTemplate(dataSource);
        // init.sql also selects its fixed deployment database; create only its base user schema here.
        jdbc.execute("""
                CREATE TABLE users (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(50) NOT NULL,
                    password VARCHAR(100) NOT NULL,
                    nickname VARCHAR(50) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'USER',
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_users_username (username)
                )
                """);
        DatabaseSchemaInitializer initializer = new DatabaseSchemaInitializer();
        ReflectionTestUtils.setField(initializer, "jdbcTemplate", jdbc);
        for (String step : List.of("ensurePaymentOrdersTable", "ensurePaymentOrderColumns",
                "ensureProductsTable", "ensureProductColumns", "ensureProductDeliveryCodesTable",
                "ensureProductDeliveryCodeColumns", "ensureMailSendLogsTable", "ensureMailSendLogColumns",
                "ensureUserColumns", "ensureUserNotificationsTable",
                "ensureUserNotificationColumns")) {
            ReflectionTestUtils.invokeMethod(initializer, step);
        }
        MybatisConfiguration configuration = new MybatisConfiguration();
        configuration.setMapUnderscoreToCamelCase(true);
        for (Class<?> mapper : List.of(PaymentOrderMapper.class, ProductMapper.class,
                ProductDeliveryCodeMapper.class, MailSendLogMapper.class,
                UserMapper.class, UserNotificationMapper.class)) {
            configuration.addMapper(mapper);
        }
        MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
        factory.setDataSource(dataSource);
        factory.setConfiguration(configuration);
        factory.setTransactionFactory(new SpringManagedTransactionFactory());
        sql = new SqlSessionTemplate(factory.getObject());
        transactions = new DataSourceTransactionManager(dataSource);
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var keys = generator.generateKeyPair();
        privateKey = Base64.getEncoder().encodeToString(keys.getPrivate().getEncoded());
        publicKey = Base64.getEncoder().encodeToString(keys.getPublic().getEncoded());
    }

    @BeforeEach
    void startProtocols() throws Exception {
        jdbc.update("DELETE FROM mail_send_logs");
        jdbc.update("DELETE FROM product_delivery_codes");
        jdbc.update("DELETE FROM payment_orders");
        jdbc.update("DELETE FROM products");
        jdbc.update("DELETE FROM user_notifications");
        jdbc.update("DELETE FROM users");
        orders = sql.getMapper(PaymentOrderMapper.class);
        products = sql.getMapper(ProductMapper.class);
        codes = sql.getMapper(ProductDeliveryCodeMapper.class);
        mailLogs = sql.getMapper(MailSendLogMapper.class);
        User buyer = new User();
        buyer.setUsername("protocol_fixture_buyer");
        buyer.setNickname("protocol fixture buyer");
        buyer.setEmail(BUYER_EMAIL);
        buyer.setPassword("fixture-no-login");
        sql.getMapper(UserMapper.class).insert(buyer);
        buyerId = buyer.getId();
        smtp = new LoopbackSmtpServer();
        delivery = deliveryService();
        AlipayFaceToFacePaymentService payment = paymentService();
        AlipayPaymentController controller = new AlipayPaymentController();
        ReflectionTestUtils.setField(controller, "alipayFaceToFacePaymentService", payment);
        context = new AnnotationConfigWebApplicationContext();
        context.register(MvcConfiguration.class);
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory(0);
        factory.setAddress(InetAddress.getByName("127.0.0.1"));
        http = factory.getWebServer(servletContext -> {
            context.setServletContext(servletContext);
            context.addBeanFactoryPostProcessor(beans -> beans.registerSingleton("alipayController", controller));
            context.refresh();
            var servlet = servletContext.addServlet("dispatcher", new DispatcherServlet(context));
            servlet.setLoadOnStartup(1);
            servlet.addMapping("/");
        });
        http.start();
    }

    private ProductDeliveryCodeService deliveryService() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("127.0.0.1");
        sender.setPort(smtp.port());
        sender.setDefaultEncoding("UTF-8");
        Properties settings = sender.getJavaMailProperties();
        settings.setProperty("mail.smtp.auth", "false");
        settings.setProperty("mail.smtp.ssl.enable", "false");
        settings.setProperty("mail.smtp.starttls.enable", "false");
        settings.setProperty("mail.smtp.connectiontimeout", "3000");
        settings.setProperty("mail.smtp.timeout", "5000");
        settings.setProperty("mail.smtp.writetimeout", "5000");
        DefaultListableBeanFactory beans = new DefaultListableBeanFactory();
        beans.registerSingleton("mailSender", sender);
        ProductDeliveryCodeService target = new ProductDeliveryCodeService();
        ReflectionTestUtils.setField(target, "productMapper", products);
        ReflectionTestUtils.setField(target, "productDeliveryCodeMapper", codes);
        ReflectionTestUtils.setField(target, "paymentOrderMapper", orders);
        ReflectionTestUtils.setField(target, "userMapper", sql.getMapper(UserMapper.class));
        ReflectionTestUtils.setField(target, "mailSendLogMapper", mailLogs);
        ReflectionTestUtils.setField(target, "transactionManager", transactions);
        ReflectionTestUtils.setField(target, "mailSenderProvider", beans.getBeanProvider(JavaMailSender.class));
        ReflectionTestUtils.setField(target, "mailBrandTemplateHelper",
                new MailBrandTemplateHelper("http://127.0.0.1", ""));
        ReflectionTestUtils.setField(target, "mailFrom", "sender@commerce.invalid");
        ReflectionTestUtils.setField(target, "springMailUsername", "");
        ReflectionTestUtils.setField(target, "mailMockEnabled", false);
        ProxyFactory proxy = new ProxyFactory(target);
        proxy.addAdvice(new TransactionInterceptor(transactions, new AnnotationTransactionAttributeSource()));
        return (ProductDeliveryCodeService) proxy.getProxy();
    }

    private AlipayFaceToFacePaymentService paymentService() {
        AlipayPaymentProperties properties = new AlipayPaymentProperties();
        properties.setEnabled(true);
        properties.setEncryptEnabled(false);
        properties.setAppId(APP_ID);
        properties.setPrivateKey(privateKey);
        properties.setAlipayPublicKey(publicKey);
        properties.setNotifyUrl("http://127.0.0.1/api/payments/alipay/notify");
        properties.setGatewayUrl("http://127.0.0.1:1/unused-gateway");
        AlipayFaceToFacePaymentService target = new AlipayFaceToFacePaymentService();
        ReflectionTestUtils.setField(target, "alipayProperties", properties);
        ReflectionTestUtils.setField(target, "paymentOrderMapper", orders);
        ReflectionTestUtils.setField(target, "productMapper", products);
        ReflectionTestUtils.setField(target, "productDeliveryCodeService", delivery);
        NotificationService notifications = new NotificationService();
        ReflectionTestUtils.setField(notifications, "userNotificationMapper", sql.getMapper(UserNotificationMapper.class));
        ReflectionTestUtils.setField(target, "notificationService", notifications);
        ReflectionTestUtils.setField(target, "objectMapper", new ObjectMapper());
        // Coupon and Redis cooldown/authorization entry points are outside this protocol test.
        // handleNotify has no transaction annotation; only the real resend annotation is proxied.
        return target;
    }

    @AfterEach
    void stopProtocols() throws Exception {
        try {
            if (http != null) http.stop();
        } finally {
            try {
                if (context != null) context.close();
            } finally {
                if (smtp != null) smtp.close();
            }
        }
    }

    @AfterAll
    static void dropOnlyOwnedDatabase() {
        if (databaseCreated) admin.execute("DROP DATABASE " + DATABASE);
    }

    @Test
    void validHttpNotificationDeductsOrdinaryStockAndSendsMimeExactlyOnce() throws Exception {
        PaymentOrder order = fixture(false);
        Map<String, String> notification = signed(order, "9.90");
        assertThat(post(notification)).isEqualTo("success");
        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertMail(order, "fixture delivery instructions");
        assertThat(post(notification)).isEqualTo("success");
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertThat(products.selectById(order.getResourceId()).getSalesCount()).isEqualTo(1);
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertThat(mailLogs.selectList(null)).extracting(MailSendLog::getStatus).containsExactly("SUCCESS");
    }

    @Test
    void duplicateHttpNotificationKeepsTheSameCdkAndDoesNotSendAgain() throws Exception {
        PaymentOrder order = fixture(true);
        Map<String, String> notification = signed(order, "9.90");
        assertThat(post(notification)).isEqualTo("success");
        assertPaid(order);
        ProductDeliveryCode assigned = assignedCode(order);
        assertThat(assigned.getCode()).isEqualTo(DELIVERY_CODE);
        assertThat(assigned.getStatus()).isEqualTo("SENT");
        assertThat(assigned.getAssignedAt()).isNotNull();
        assertThat(assigned.getSentAt()).isNotNull();
        assertMail(order, DELIVERY_ACCOUNT, DELIVERY_URL);

        assertThat(post(notification)).isEqualTo("success");
        assertThat(assignedCode(order).getId()).isEqualTo(assigned.getId());
        assertCdkStock(order);
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertThat(mailLogs.selectList(null)).extracting(MailSendLog::getStatus).containsExactly("SUCCESS");
    }

    @Test
    void tamperedHttpNotificationHasNoPaymentInventoryOrMailSideEffects() throws Exception {
        PaymentOrder order = fixture(true);
        Map<String, String> notification = signed(order, "9.90");
        notification.put("total_amount", "0.01");
        assertThat(post(notification)).isEqualTo("failure");
        assertUnchanged(order);
    }

    @Test
    void correctlySignedWrongAmountHasNoPaymentInventoryOrMailSideEffects() throws Exception {
        PaymentOrder order = fixture(true);
        assertThat(post(signed(order, "0.01"))).isEqualTo("failure");
        assertUnchanged(order);
    }

    @Test
    void smtpRejectionKeepsPaymentAndLockedCdkThenTransactionalResendUsesTheSameCode() throws Exception {
        PaymentOrder order = fixture(true);
        Map<String, String> notification = signed(order, "9.90");
        smtp.acceptMessages(false);
        assertThat(post(notification)).isEqualTo("success");
        assertPaid(order);
        ProductDeliveryCode locked = assignedCode(order);
        assertThat(locked.getStatus()).isEqualTo("LOCKED");
        assertThat(locked.getSentAt()).isNull();
        assertThat(orders.selectById(order.getId()).getLastError()).contains("CDK邮件发送失败");
        List<MailSendLog> failedLogs = mailLogs.selectList(null);
        assertThat(failedLogs).extracting(MailSendLog::getStatus).containsExactly("FAILED");
        assertThat(failedLogs.get(0).getErrorMessage()).contains("451");
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertThat(smtp.messages()).isEmpty();

        assertThat(post(notification)).isEqualTo("success");
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertThat(assignedCode(order).getId()).isEqualTo(locked.getId());
        assertCdkStock(order);

        smtp.acceptMessages(true);
        delivery.resendPaidOrder(orders.selectById(order.getId()));
        ProductDeliveryCode sent = assignedCode(order);
        assertThat(sent.getId()).isEqualTo(locked.getId());
        assertThat(sent.getCode()).isEqualTo(locked.getCode());
        assertThat(sent.getStatus()).isEqualTo("SENT");
        assertThat(sent.getSentAt()).isNotNull();
        assertCdkStock(order);
        assertThat(smtp.submissionCount()).isEqualTo(2);
        assertMail(order, locked.getCode());
        assertThat(mailLogs.selectList(new QueryWrapper<MailSendLog>().orderByAsc("id")))
                .extracting(MailSendLog::getStatus).containsExactly("FAILED", "SUCCESS");
    }

    @Test
    void historicalPaidOrderWithoutContentKeepsFailureAuditWithoutSubmittingSmtp() {
        PaymentOrder order = historicalPaidOrderWithoutContent();

        assertThat(delivery.fulfillPaidOrder(order)).isEqualTo(MISSING_CONTENT_ERROR);

        assertFailedContentAttempt(order);
        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertThat(codes.selectList(null)).isEmpty();
    }

    @Test
    void httpNotificationWithoutContentSettlesPaymentOnceAndKeepsDeliveryFailureVisible() throws Exception {
        PaymentOrder order = fixture(false);
        jdbc.update("UPDATE products SET delivery_instructions = NULL, description = ? WHERE id = ?",
                "Marketing description is not an order deliverable", order.getResourceId());
        Map<String, String> notification = signed(order, "9.90");

        assertThat(post(notification)).isEqualTo("success");

        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertThat(orders.selectById(order.getId()).getLastError()).isEqualTo(MISSING_CONTENT_ERROR);
        assertFailedContentAttempt(order);
        List<UserNotification> notifications = sql.getMapper(UserNotificationMapper.class)
                .selectList(new QueryWrapper<UserNotification>().orderByAsc("id"));
        assertThat(notifications).extracting(UserNotification::getType)
                .containsExactly("PAYMENT_SUCCESS", "DELIVERY_FAILED");
        assertThat(notifications.get(1).getUserId()).isEqualTo(buyerId);
        assertThat(notifications.get(1).getContent()).contains(order.getOutTradeNo(), MISSING_CONTENT_ERROR);
        assertThat(notifications.get(1).getRelatedPath()).isEqualTo("/orders?order=" + order.getOutTradeNo());

        assertThat(post(notification)).isEqualTo("success");

        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertThat(orders.selectById(order.getId()).getLastError()).isEqualTo(MISSING_CONTENT_ERROR);
        assertThat(codes.selectList(null)).isEmpty();
        assertThat(sql.getMapper(UserNotificationMapper.class).selectList(null)).hasSize(2);
        assertFailedContentAttempt(order);
    }

    @Test
    void failedTransactionalResendKeepsAuditThenConfiguredResendDoesNotConsumeStockAgain() throws Exception {
        PaymentOrder order = historicalPaidOrderWithoutContent();
        order.setLastError(MISSING_CONTENT_ERROR);
        orders.updateById(order);

        assertThatThrownBy(() -> delivery.resendPaidOrder(order))
                .isInstanceOf(ApiException.class)
                .hasMessage(MISSING_CONTENT_ERROR);

        // The service transaction has already rolled back when this independent read occurs.
        assertFailedContentAttempt(order);
        assertPaid(order);
        assertThat(orders.selectById(order.getId()).getLastError()).isEqualTo(MISSING_CONTENT_ERROR);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);

        jdbc.update("UPDATE products SET delivery_instructions = ? WHERE id = ?",
                DELIVERY_ACCOUNT + "\n" + DELIVERY_URL, order.getResourceId());
        delivery.resendPaidOrder(orders.selectById(order.getId()));

        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isEqualTo(1);
        assertThat(codes.selectList(null)).isEmpty();
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertMail(order, DELIVERY_ACCOUNT, DELIVERY_URL);
        assertThat(mailLogs.selectList(new QueryWrapper<MailSendLog>().orderByAsc("id")))
                .extracting(MailSendLog::getStatus).containsExactly("FAILED", "SUCCESS");
        assertThat(orders.selectById(order.getId()).getLastError()).isNull();
    }

    @Test
    void historicalPaidOrdinaryOrderConvertedToCdkAllocatesOneMailboxLinkOnResend() throws Exception {
        PaymentOrder order = historicalPaidOrderWithoutContent();
        order.setLastError(MISSING_CONTENT_ERROR);
        orders.updateById(order);
        jdbc.update("UPDATE products SET delivery_type = 'CDK_EMAIL', stock = 0 WHERE id = ?",
                order.getResourceId());
        ProductDeliveryCode available = new ProductDeliveryCode();
        available.setProductId(order.getResourceId());
        available.setCode(DELIVERY_CODE);
        available.setStatus("AVAILABLE");
        available.setCreatedBy(1L);
        codes.insert(available);

        delivery.resendPaidOrder(orders.selectById(order.getId()));

        ProductDeliveryCode sent = assignedCode(order);
        assertThat(sent.getId()).isEqualTo(available.getId());
        assertThat(sent.getCode()).isEqualTo(DELIVERY_CODE);
        assertThat(sent.getAssignedTo()).isEqualTo(buyerId);
        assertThat(sent.getStatus()).isEqualTo("SENT");
        assertThat(sent.getAssignedAt()).isNotNull();
        assertThat(sent.getSentAt()).isNotNull();
        assertThat(codes.selectList(new QueryWrapper<ProductDeliveryCode>().eq("status", "AVAILABLE")))
                .isEmpty();
        assertThat(codes.selectList(null)).hasSize(1);
        assertThat(orders.selectList(null)).extracting(PaymentOrder::getId).containsExactly(order.getId());
        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isZero();
        assertThat(smtp.submissionCount()).isEqualTo(1);
        assertMail(order, DELIVERY_ACCOUNT, DELIVERY_URL);
        assertThat(mailLogs.selectList(null)).extracting(MailSendLog::getStatus).containsExactly("SUCCESS");
        assertThat(orders.selectById(order.getId()).getLastError()).isNull();
    }

    private PaymentOrder historicalPaidOrderWithoutContent() {
        PaymentOrder order = fixture(false);
        jdbc.update("UPDATE products SET delivery_instructions = NULL, description = ?, subtitle = ?, "
                        + "stock = 1, sales_count = 1 WHERE id = ?",
                "Marketing description is not an order deliverable", "protocol fixture product", order.getResourceId());
        order.setStatus("TRADE_SUCCESS");
        order.setTradeNo("fixture_trade_" + order.getId());
        order.setPaidTime(new Date());
        order.setPaidHandled(true);
        orders.updateById(order);
        return orders.selectById(order.getId());
    }

    private void assertFailedContentAttempt(PaymentOrder order) {
        List<MailSendLog> attempts = mailLogs.selectList(new QueryWrapper<MailSendLog>()
                .eq("order_no", order.getOutTradeNo()));
        assertThat(attempts).hasSize(1);
        assertThat(attempts.get(0).getMailType()).isEqualTo("PRODUCT_DELIVERY");
        assertThat(attempts.get(0).getStatus()).isEqualTo("FAILED");
        assertThat(attempts.get(0).getErrorMessage()).isEqualTo(MISSING_CONTENT_ERROR);
        assertThat(attempts.get(0).getRecipientEmail()).isEqualTo(BUYER_EMAIL);
        assertThat(attempts.get(0).getProductId()).isEqualTo(order.getResourceId());
        assertThat(smtp.submissionCount()).isZero();
        assertThat(smtp.messages()).isEmpty();
    }

    private ProductDeliveryCode assignedCode(PaymentOrder order) {
        List<ProductDeliveryCode> assigned = codes.selectList(new QueryWrapper<ProductDeliveryCode>()
                .eq("order_no", order.getOutTradeNo()));
        assertThat(assigned).hasSize(1);
        return assigned.get(0);
    }

    private void assertCdkStock(PaymentOrder order) {
        assertPaid(order);
        assertThat(products.selectById(order.getResourceId()).getStock()).isZero();
        assertThat(codes.selectList(new QueryWrapper<ProductDeliveryCode>().eq("status", "AVAILABLE")))
                .extracting(ProductDeliveryCode::getCode).containsExactly("FIXTURE-CODE-B");
    }

    private void assertUnchanged(PaymentOrder order) {
        PaymentOrder saved = orders.selectById(order.getId());
        assertThat(saved.getStatus()).isEqualTo("WAIT_BUYER_PAY");
        assertThat(saved.getPaidHandled()).isFalse();
        assertThat(saved.getPaidTime()).isNull();
        assertThat(saved.getTradeNo()).isNull();
        assertThat(saved.getNotifyPayload()).isNull();
        assertThat(products.selectById(order.getResourceId()).getSalesCount()).isZero();
        assertThat(products.selectById(order.getResourceId()).getStock()).isZero();
        assertThat(codes.selectList(null)).extracting(ProductDeliveryCode::getStatus)
                .containsExactly("AVAILABLE", "AVAILABLE");
        assertThat(codes.selectList(null)).allSatisfy(code -> {
            assertThat(code.getOrderNo()).isNull();
            assertThat(code.getAssignedAt()).isNull();
            assertThat(code.getSentAt()).isNull();
        });
        assertThat(mailLogs.selectList(null)).isEmpty();
        assertThat(smtp.submissionCount()).isZero();
        assertThat(smtp.messages()).isEmpty();
    }

    private PaymentOrder fixture(boolean cdk) {
        Product product = new Product();
        product.setTitle("protocol fixture product");
        product.setPrice(new BigDecimal("9.90"));
        product.setStock(cdk ? 0 : 2);
        product.setSalesCount(0);
        product.setDeliveryType(cdk ? "CDK_EMAIL" : "NONE");
        product.setDeliveryInstructions("fixture delivery instructions");
        product.setStatus("ON_SALE");
        products.insert(product);
        if (cdk) {
            for (String value : List.of(DELIVERY_CODE, "FIXTURE-CODE-B")) {
                ProductDeliveryCode code = new ProductDeliveryCode();
                code.setProductId(product.getId());
                code.setCode(value);
                code.setStatus("AVAILABLE");
                code.setCreatedBy(1L);
                codes.insert(code);
            }
        }
        PaymentOrder order = new PaymentOrder();
        order.setChannel("ALIPAY_F2F");
        order.setOutTradeNo("fixture_" + UUID.randomUUID().toString().replace("-", ""));
        order.setSubject(product.getTitle());
        order.setTotalAmount(new BigDecimal("9.90"));
        order.setStatus("WAIT_BUYER_PAY");
        order.setResourceType("PRODUCT");
        order.setResourceId(product.getId());
        order.setPayerUserId(buyerId);
        order.setDeliveryEmail(BUYER_EMAIL);
        order.setPaidHandled(false);
        orders.insert(order);
        return order;
    }

    private Map<String, String> signed(PaymentOrder order, String amount) throws Exception {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_id", APP_ID);
        params.put("out_trade_no", order.getOutTradeNo());
        params.put("trade_no", "fixture_trade_" + order.getId());
        params.put("trade_status", "TRADE_SUCCESS");
        params.put("total_amount", amount);
        params.put("sign", AlipaySignature.rsaSign(
                AlipaySignature.getSignContent(params), privateKey, "UTF-8", "RSA2"));
        params.put("sign_type", "RSA2");
        return params;
    }

    private String post(Map<String, String> params) throws Exception {
        String form = params.entrySet().stream().map(entry ->
                URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8) + "="
                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8)).collect(Collectors.joining("&"));
        URI uri = URI.create("http://127.0.0.1:" + http.getPort() + "/api/payments/alipay/notify");
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .build().send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type").orElse("")).startsWith("text/plain");
        return response.body();
    }

    private void assertPaid(PaymentOrder original) {
        PaymentOrder saved = orders.selectById(original.getId());
        assertThat(saved.getStatus()).isEqualTo("TRADE_SUCCESS");
        assertThat(saved.getPaidHandled()).isTrue();
        assertThat(saved.getPaidTime()).isNotNull();
        assertThat(saved.getTradeNo()).isEqualTo("fixture_trade_" + original.getId());
        assertThat(products.selectById(original.getResourceId()).getSalesCount()).isEqualTo(1);
    }

    private void assertMail(PaymentOrder order, String... expectedContents) throws Exception {
        assertThat(smtp.messages()).hasSize(1);
        MimeMessage mime = new MimeMessage(Session.getInstance(new Properties()),
                new ByteArrayInputStream(smtp.messages().get(0)));
        assertThat(mime.getAllRecipients()).extracting(Object::toString).containsExactly(BUYER_EMAIL);
        assertThat(mime.getSubject()).contains("protocol fixture product");
        assertThat(mime.getMessageID()).isNotBlank();
        assertThat(HtmlUtils.htmlUnescape(textContent(mime))).contains(order.getOutTradeNo()).contains(expectedContents);
    }

    private String textContent(Part part) throws Exception {
        if (part.isMimeType("text/*")) return (String) part.getContent();
        if (!part.isMimeType("multipart/*")) return "";
        Multipart multipart = (Multipart) part.getContent();
        StringBuilder text = new StringBuilder();
        for (int index = 0; index < multipart.getCount(); index++) {
            text.append(textContent(multipart.getBodyPart(index)));
        }
        return text.toString();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    static class MvcConfiguration { }
}
