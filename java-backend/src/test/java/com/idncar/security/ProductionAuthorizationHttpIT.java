package com.idncar.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.function.Executable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Explicit opt-in: -Dtest=ProductionAuthorizationHttpIT -Dauthorization.fixture-manifest=...
 * Exercises the running application, its real security chain, MySQL and Redis. The manifest
 * must identify an isolated local fixture; never point this test at an existing deployment.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProductionAuthorizationHttpIT {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final List<Account> accounts = new ArrayList<>();
    private final String runId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    private Connection database;
    private URI baseUrl;
    private String allowedOrigin;
    private Account user;
    private Account admin;
    private Account owner;
    private int httpChecks;

    @BeforeAll
    void connectOnlyToVerifiedIsolatedFixture() throws Exception {
        String manifestValue = System.getProperty("authorization.fixture-manifest", "");
        assertTrue(!manifestValue.isBlank(), "Explicit authorization.fixture-manifest is required; no live defaults");
        Path manifestPath = Path.of(manifestValue).toRealPath();
        JsonNode manifest = json.readTree(Files.readString(manifestPath));
        assertEquals("remaining-boundaries-authorization", manifest.path("purpose").asText());
        Path root = Path.of(required(manifest, "fixtureRoot")).toRealPath();
        assertTrue(manifestPath.startsWith(root), "Manifest must be inside its isolated fixture root");
        assertTrue(normalize(root.toString()).contains("/work/remaining-boundaries/"), "Unexpected fixture root");
        Path dataDir = Path.of(required(manifest, "mysqlDataDir")).toRealPath();
        assertTrue(dataDir.startsWith(root), "MySQL data directory must be inside fixture root");
        Path sourceManifest = Path.of(required(manifest, "sourceManifest")).toRealPath();
        assertTrue(sourceManifest.startsWith(root) && Files.isRegularFile(sourceManifest), "Source identity is required");

        baseUrl = URI.create(required(manifest, "baseUrl"));
        validateEndpoint(baseUrl, "http", manifest.path("javaPort").asInt());
        assertTrue(baseUrl.getPath().isEmpty() || "/".equals(baseUrl.getPath()), "HTTP base must have no path");
        String jdbcUrl = required(manifest, "jdbcUrl");
        assertTrue(jdbcUrl.startsWith("jdbc:mysql://"), "Only isolated MySQL is supported");
        URI mysqlUrl = URI.create(jdbcUrl.substring("jdbc:".length()));
        validateEndpoint(mysqlUrl, "mysql", manifest.path("mysqlPort").asInt());
        assertEquals("/mail", mysqlUrl.getPath(), "Unexpected isolated schema");
        assertTrue(mysqlUrl.getQuery() == null || !mysqlUrl.getQuery().matches("(?i).*(user|password)=.*"),
                "JDBC URL must not contain credentials");
        verifyProcess(manifest, "mysql", "mysqld", dataDir);
        verifyProcess(manifest, "java", "java", root);
        allowedOrigin = required(manifest, "allowedOrigin");
        assertEquals("https://idncar.com", allowedOrigin, "Use the production public origin for CORS checks");

        database = DriverManager.getConnection(jdbcUrl, "root", "");
        try (var statement = database.createStatement(); var result = statement.executeQuery("SELECT @@datadir, @@port")) {
            assertTrue(result.next());
            assertEquals(dataDir, Path.of(result.getString(1)).toRealPath(), "Connected to unexpected database storage");
            assertEquals(mysqlUrl.getPort(), result.getInt(2), "Connected to unexpected database port");
        }
        expect("GET", "/actuator/health", null, null, 200);
        user = createAccount("user", "USER");
        admin = createAccount("admin", "ADMIN");
        owner = createAccount("owner", "OWNER");
        for (Account account : List.of(user, admin, owner)) login(account);
    }

    @Test
    void publicReadsRemainPublicWithOrWithoutAnInvalidBearer() {
        List<Executable> checks = new ArrayList<>();
        for (String path : List.of("/api/products", "/api/forum/boards")) {
            for (Account account : identities()) checks.add(() -> expect("GET", path, account, null, 200));
            checks.add(() -> expect("GET", path, invalidBearer(), null, 200));
        }
        assertAll(checks);
    }

    @Test
    void privateReadsRequireAnActiveSessionForEveryRole() {
        List<Executable> checks = new ArrayList<>();
        for (String path : List.of("/api/auth/me", "/api/tools/diagnostics", "/api/payments/alipay/orders",
                "/api/forum/sign-in/status", "/api/forum/board-owner-applications/mine")) {
            for (Account account : identities()) {
                checks.add(() -> expect("GET", path, account, null, account == null ? 401 : 200));
            }
            checks.add(() -> expect("GET", path, invalidBearer(), null, 401));
        }
        assertAll(checks);
    }

    @Test
    void everyAdminControllerRejectsOrdinaryUsersAndAllowsAdminRoles() {
        List<Executable> checks = new ArrayList<>();
        for (String path : List.of(
                "/api/admin/users/stats", "/api/admin/invite-codes/stats", "/api/admin/downloads/stats",
                "/api/admin/site-notices/stats", "/api/admin/post-reports/stats", "/api/admin/operation-logs/page",
                "/api/admin/products/stats", "/api/admin/product-delivery-codes/stats",
                "/api/admin/product-coupon-codes/stats", "/api/admin/payment-orders/stats",
                "/api/admin/mail-send-logs", "/api/admin/analytics/overview", "/api/admin/qr-codes",
                "/api/admin/system-health", "/api/admin/payments/vmq/settings",
                "/api/forum/board-owner-applications")) {
            for (Account account : identities()) {
                int expected = account == null ? 401 : account == user ? 403 : 200;
                checks.add(() -> expect("GET", path, account, null, expected));
            }
        }
        assertAll(checks);
    }

    @Test
    void everyNotificationOperationAuthenticatesBeforeBindingUserId() throws Exception {
        List<Executable> checks = new ArrayList<>();
        for (Account account : identities()) {
            long notificationId = account == null ? 1 : createNotification(account);
            int expected = account == null ? 401 : 200;
            checks.add(() -> expect("GET", "/api/notifications", account, null, expected));
            checks.add(() -> expect("GET", "/api/notifications/unread-count", account, null, expected));
            checks.add(() -> expect("POST", "/api/notifications/" + notificationId + "/read", account, null, expected));
            checks.add(() -> expect("POST", "/api/notifications/read-all", account, null, expected));
        }
        assertAll(checks);
    }

    @Test
    void notificationCannotBeReadByAnotherUserOrAdministrator() throws Exception {
        Account stranger = createAccount("stranger", "USER");
        login(stranger);
        long notificationId = createNotification(user);
        expect("POST", "/api/notifications/" + notificationId + "/read", stranger, null, 404);
        expect("POST", "/api/notifications/" + notificationId + "/read", admin, null, 404);
        expect("POST", "/api/notifications/" + notificationId + "/read", owner, null, 404);
        try (var query = database.prepareStatement("SELECT read_status FROM user_notifications WHERE id = ? AND user_id = ?")) {
            query.setLong(1, notificationId);
            query.setLong(2, user.id);
            try (var result = query.executeQuery()) {
                assertTrue(result.next());
                assertEquals(0, result.getInt(1), "Rejected requests must not mutate another user's notification");
            }
        }
        expect("POST", "/api/notifications/" + notificationId + "/read", user, null, 200);
    }

    @Test
    void logoutAndReplacementLoginInvalidateOldSessions() throws Exception {
        Account account = createAccount("sessions", "USER");
        login(account);
        expect("GET", "/api/auth/me", account, null, 200);
        expect("POST", "/api/auth/logout", account, null, 200);
        expect("GET", "/api/auth/me", account, null, 401);

        // JWT timestamps have second precision; each login must mint a different token.
        Thread.sleep(1100);
        login(account);
        Account oldSession = new Account("replaced-session", account.id, account.username, account.password);
        oldSession.token = account.token;
        Thread.sleep(1100);
        login(account);
        assertTrue(!oldSession.token.equals(account.token), "Session replacement must issue a distinct token");
        expect("GET", "/api/auth/me", oldSession, null, 401);
        expect("GET", "/api/auth/me", account, null, 200);
    }

    @Test
    void disablingAUserInvalidatesItsSessionAndBlocksLogin() throws Exception {
        Account account = createAccount("disabled", "USER");
        login(account);
        expect("PUT", "/api/admin/users/" + account.id, admin, Map.of("status", "DISABLED"), 200);
        expect("GET", "/api/auth/me", account, null, 401);
        expect("POST", "/api/auth/login", null,
                Map.of("username", account.username, "password", account.password), 403);
    }

    @Test
    void onlyOwnerCanGrantAdminAndOwnerAccountsCannotBeEdited() throws Exception {
        Account target = createAccount("promotion", "USER");
        login(target);
        String path = "/api/admin/users/" + target.id;
        expect("PUT", path, user, Map.of("role", "ADMIN"), 403);
        expect("PUT", path, admin, Map.of("role", "ADMIN"), 403);
        expect("GET", "/api/admin/users/stats", target, null, 403);
        expect("PUT", path, owner, Map.of("role", "ADMIN"), 200);
        expect("GET", "/api/admin/users/stats", target, null, 200);
        expect("PUT", path, admin, Map.of("nickname", "blocked-change"), 403);
        expect("PUT", path, owner, Map.of("role", "USER"), 200);
        expect("GET", "/api/admin/users/stats", target, null, 403);
        expect("PUT", "/api/admin/users/" + admin.id, admin, Map.of("nickname", "blocked-change"), 403);
        expect("PUT", "/api/admin/users/" + owner.id, admin, Map.of("nickname", "blocked-change"), 403);
        expect("PUT", "/api/admin/users/" + owner.id, owner, Map.of("nickname", "blocked-change"), 403);
        expect("PUT", path, owner, Map.of("role", "OWNER"), 400);
    }

    @Test
    void actuatorDetailsAreDeniedForEveryRole() {
        List<Executable> checks = new ArrayList<>();
        for (Account account : identities()) {
            checks.add(() -> expect("GET", "/actuator/info", account, null, account == null ? 401 : 403));
        }
        assertAll(checks);
    }

    @Test
    void productionOriginIsAllowedAndUntrustedOriginIsRejected() throws Exception {
        HttpResponse<String> allowed = preflight(allowedOrigin);
        assertEquals(200, allowed.statusCode(), "Production-origin preflight");
        assertEquals(allowedOrigin, allowed.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        assertEquals("true", allowed.headers().firstValue("Access-Control-Allow-Credentials").orElse(""));
        HttpResponse<String> rejected = preflight("https://untrusted.example");
        assertEquals(403, rejected.statusCode(), "Untrusted-origin preflight");
        assertTrue(rejected.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
        System.out.println("[AUTHZ] CORS production-origin=200 untrusted-origin=403");
        httpChecks += 2;
    }

    @AfterAll
    void removeOnlyThisRunsFixtureAccounts() throws Exception {
        if (database == null) return;
        try {
            for (Account account : accounts) {
                if (account.token != null) {
                    int status = request("POST", "/api/auth/logout", account, null).statusCode();
                    assertTrue(status == 200 || status == 401, "Fixture logout failed for " + account.alias);
                }
            }
            database.setAutoCommit(false);
            try {
                for (Account account : accounts) {
                    deleteByUser("DELETE FROM login_records WHERE user_id = ?", account.id);
                    deleteByUser("DELETE FROM admin_operation_logs WHERE operator_id = ?", account.id);
                    try (var delete = database.prepareStatement("DELETE FROM users WHERE id = ? AND username = ?")) {
                        delete.setLong(1, account.id);
                        delete.setString(2, account.username);
                        assertEquals(1, delete.executeUpdate(), "Fixture account cleanup must be exact");
                    }
                }
                database.commit();
            } catch (Exception | AssertionError failure) {
                database.rollback();
                throw failure;
            }
            System.out.printf("[AUTHZ] completed HTTP assertions=%d; cleaned fixture accounts=%d%n", httpChecks, accounts.size());
        } finally {
            database.close();
        }
    }

    private List<Account> identities() {
        return java.util.Arrays.asList(null, user, admin, owner);
    }

    private Account invalidBearer() {
        Account invalid = new Account("invalid-bearer", 0, "", "");
        invalid.token = "invalid.fixture.token";
        return invalid;
    }

    private Account createAccount(String alias, String role) throws Exception {
        String username = "authz_" + runId + "_" + alias;
        String password = "Authz!" + UUID.randomUUID();
        try (var insert = database.prepareStatement(
                "INSERT INTO users(username, email, password, nickname, role, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
                Statement.RETURN_GENERATED_KEYS)) {
            insert.setString(1, username);
            insert.setString(2, username + "@example.invalid");
            insert.setString(3, new BCryptPasswordEncoder().encode(password));
            insert.setString(4, username);
            insert.setString(5, role);
            assertEquals(1, insert.executeUpdate());
            try (var keys = insert.getGeneratedKeys()) {
                assertTrue(keys.next());
                Account account = new Account(alias, keys.getLong(1), username, password);
                accounts.add(account);
                return account;
            }
        }
    }

    private long createNotification(Account account) throws Exception {
        try (var insert = database.prepareStatement(
                "INSERT INTO user_notifications(user_id, type, title, content, read_status) VALUES (?, 'SYSTEM', ?, ?, 0)",
                Statement.RETURN_GENERATED_KEYS)) {
            insert.setLong(1, account.id);
            insert.setString(2, "Authorization fixture " + runId);
            insert.setString(3, "Only this isolated fixture account may read this notification.");
            assertEquals(1, insert.executeUpdate());
            try (var keys = insert.getGeneratedKeys()) {
                assertTrue(keys.next());
                return keys.getLong(1);
            }
        }
    }

    private void login(Account account) throws Exception {
        HttpResponse<String> response = expect("POST", "/api/auth/login", null,
                Map.of("username", account.username, "password", account.password), 200);
        JsonNode body = json.readTree(response.body());
        assertTrue(body.path("token").isTextual() && !body.path("token").asText().isBlank(), "Login must issue a token");
        assertEquals(account.id, body.path("user").path("id").asLong(), "Login returned unexpected fixture identity");
        account.token = body.path("token").asText();
    }

    private HttpResponse<String> expect(String method, String path, Account account, Object body, int expected) throws Exception {
        HttpResponse<String> response = request(method, path, account, body);
        String label = (account == null ? "anonymous" : account.alias) + " " + method + " " + path;
        System.out.printf("[AUTHZ] %s expected=%d actual=%d%n", label, expected, response.statusCode());
        httpChecks++;
        // Never include login tokens, passwords or administrator DTOs in assertion output.
        assertEquals(expected, response.statusCode(), label);
        return response;
    }

    private HttpResponse<String> request(String method, String path, Account account, Object body) throws Exception {
        var builder = HttpRequest.newBuilder(baseUrl.resolve(path)).timeout(Duration.ofSeconds(15));
        if (account != null && account.token != null) builder.header("Authorization", "Bearer " + account.token);
        if (body != null) builder.header("Content-Type", "application/json");
        return http.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> preflight(String origin) throws Exception {
        return http.send(HttpRequest.newBuilder(baseUrl.resolve("/api/auth/me")).timeout(Duration.ofSeconds(15))
                .header("Origin", origin).header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "authorization")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
    }

    private void deleteByUser(String sql, long id) throws Exception {
        try (var delete = database.prepareStatement(sql)) {
            delete.setLong(1, id);
            delete.executeUpdate();
        }
    }

    private String required(JsonNode node, String key) {
        String value = node.path(key).asText();
        assertTrue(!value.isBlank(), "Fixture manifest missing " + key);
        return value;
    }

    private void validateEndpoint(URI endpoint, String scheme, int expectedPort) {
        assertEquals(scheme, endpoint.getScheme());
        assertEquals("127.0.0.1", endpoint.getHost(), "Only explicit IPv4 loopback is allowed");
        assertTrue(endpoint.getUserInfo() == null && endpoint.getFragment() == null, "Unexpected endpoint fields");
        assertTrue(expectedPort > 1024 && expectedPort <= 65535 && expectedPort != 3306 && expectedPort != 33060,
                "Only a nonstandard isolated port is allowed");
        assertEquals(expectedPort, endpoint.getPort(), "Endpoint and manifest ports differ");
    }

    private void verifyProcess(JsonNode manifest, String prefix, String executable, Path expectedPath) throws Exception {
        long pid = manifest.path(prefix + "Pid").asLong();
        ProcessHandle process = ProcessHandle.of(pid).orElseThrow(() -> new AssertionError("Fixture process missing: " + prefix));
        assertTrue(process.isAlive(), "Fixture process is not running: " + prefix);
        var info = process.info();
        Instant started = info.startInstant().orElseThrow(() -> new AssertionError("Process start identity unavailable: " + prefix));
        assertTrue(Duration.between(Instant.parse(required(manifest, prefix + "StartedAt")), started).abs().toMillis() < 1000,
                "Process start identity changed: " + prefix);
        String command = info.command().orElseThrow(() -> new AssertionError("Process executable unavailable: " + prefix));
        assertTrue(Path.of(command).getFileName().toString().toLowerCase().startsWith(executable), "Unexpected fixture executable");
        String arguments = System.getProperty("os.name").startsWith("Windows")
                ? windowsProcessArguments(pid, manifest.path(prefix + "Port").asInt())
                : String.join(" ", info.arguments().orElseThrow(() -> new AssertionError("Process arguments unavailable: " + prefix)));
        assertTrue(normalize(arguments).contains(normalize(expectedPath.toString())), "Process does not belong to fixture directory: " + prefix);
    }

    private String windowsProcessArguments(long pid, int port) throws Exception {
        // Windows ProcessHandle exposes executable/start time but not arguments. CIM also
        // lets us prove that this PID, rather than an unrelated service, owns the loopback port.
        String script = "$ErrorActionPreference='Stop'; $fixtureProcess=Get-CimInstance Win32_Process -Filter 'ProcessId = " + pid + "'; "
                + "$fixtureListeners=@(Get-NetTCPConnection -State Listen -LocalPort " + port + "); "
                + "@{commandLine=$fixtureProcess.CommandLine; ownsPort=[bool]($fixtureListeners | Where-Object "
                + "{ $_.OwningProcess -eq " + pid + " -and $_.LocalAddress -eq '127.0.0.1' })} | ConvertTo-Json -Compress";
        Process probe = new ProcessBuilder("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script).start();
        if (!probe.waitFor(15, TimeUnit.SECONDS)) {
            probe.destroyForcibly();
            throw new AssertionError("Windows fixture process inspection timed out");
        }
        assertEquals(0, probe.exitValue(), "Windows fixture process inspection failed");
        JsonNode state = json.readTree(probe.getInputStream());
        assertTrue(state.path("ownsPort").asBoolean(), "Fixture PID does not own its loopback port");
        return required(state, "commandLine");
    }

    private String normalize(String value) {
        return value.replace('\\', '/').toLowerCase(java.util.Locale.ROOT);
    }

    private static final class Account {
        final String alias;
        final long id;
        final String username;
        final String password;
        String token;

        Account(String alias, long id, String username, String password) {
            this.alias = alias;
            this.id = id;
            this.username = username;
            this.password = password;
        }
    }
}
