package com.idncar.config;

import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.service.AlipayFaceToFacePaymentService;
import com.idncar.util.HotmailCredentialCrypto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.sql.SQLSyntaxErrorException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Answers.RETURNS_DEFAULTS;
import static org.mockito.Mockito.mock;

class DatabaseSchemaStartupTest {
    @Test
    void scheduledOrderQueryWaitsForSchemaUpgrade() throws Exception {
        StartupState state = new StartupState();
        var executor = Executors.newSingleThreadExecutor();
        var started = executor.submit(() -> application(state, true).run());
        ConfigurableApplicationContext context = null;
        try {
            assertThat(state.schemaEntered.await(10, TimeUnit.SECONDS)).isTrue();
            boolean queriedBeforeUpgrade = state.scheduledQuery.await(1, TimeUnit.SECONDS);
            state.releaseSchema.countDown();
            context = started.get(10, TimeUnit.SECONDS);

            assertThat(queriedBeforeUpgrade)
                    .as("scheduled order query ran before schema upgrade: %s",
                            state.schedulingErrors.stream().map(Throwable::getCause).toList())
                    .isFalse();
            assertThat(state.scheduledQuery.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(state.supportColumnReady).isTrue();
            assertThat(state.schemaCalls.get()).isGreaterThan(20);
            assertThat(state.schedulingErrors).isEmpty();
            assertThat(state.readyEvents.get()).isEqualTo(1);
        } finally {
            state.releaseSchema.countDown();
            if (context == null && !started.isCancelled()) {
                try { context = started.get(10, TimeUnit.SECONDS); }
                catch (java.util.concurrent.ExecutionException ignored) { /* Startup failure owns context cleanup. */ }
            }
            if (context != null) context.close();
            executor.shutdownNow();
        }
    }

    @Test
    void failedSchemaUpgradePreventsReadinessAndScheduledQueries() {
        StartupState state = new StartupState();
        state.failSchema = true;
        state.releaseSchema.countDown();

        assertThatThrownBy(() -> application(state, true).run())
                .hasStackTraceContaining("schema migration fixture failure");
        assertThat(state.readyEvents.get()).isZero();
        assertThat(state.scheduledCalls.get()).isZero();
    }

    @Test
    void externallyMigratedDatabaseCanDisableAutomaticSchemaUpgrade() throws Exception {
        StartupState state = new StartupState();
        state.supportColumnReady.set(true);

        try (var context = application(state, false).run()) {
            assertThat(state.scheduledQuery.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(state.schemaCalls.get()).isZero();
            assertThat(state.readyEvents.get()).isEqualTo(1);
            assertThat(state.schedulingErrors).isEmpty();
            assertThat(context.getBeansOfType(DatabaseSchemaInitializer.class)).isEmpty();
        }
    }

    private SpringApplication application(StartupState state, boolean initialize) {
        SpringApplication application = new SpringApplication(StartupConfiguration.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.setRegisterShutdownHook(false);
        application.setLogStartupInfo(false);
        application.setDefaultProperties(Map.of(
                "spring.config.location", "optional:classpath:/schema-lifecycle-test.properties",
                "spring.main.banner-mode", "off",
                "logging.level.root", "OFF",
                "app.schema.auto-init-enabled", String.valueOf(initialize)));
        application.addListeners(event -> {
            if (event instanceof ApplicationReadyEvent) state.readyEvents.incrementAndGet();
        });
        application.addInitializers(context -> {
            GenericApplicationContext registry = (GenericApplicationContext) context;
            registry.getBeanFactory().registerSingleton("startupState", state);
            registry.getBeanFactory().registerSingleton("jdbcTemplate", schemaJdbc(state));
            registry.getBeanFactory().registerSingleton("hotmailCredentialCrypto", mock(HotmailCredentialCrypto.class));
            for (var field : AlipayFaceToFacePaymentService.class.getDeclaredFields()) {
                if (field.isAnnotationPresent(Autowired.class)) {
                    registerDependency(registry, field.getType(), state);
                }
            }
        });
        return application;
    }

    private <T> void registerDependency(GenericApplicationContext registry, Class<T> type, StartupState state) {
        registry.getBeanFactory().registerSingleton(type.getName(), mock(type, invocation -> {
            if (type == PaymentOrderMapper.class && invocation.getMethod().getName().equals("selectList")) {
                state.scheduledCalls.incrementAndGet();
                state.scheduledQuery.countDown();
                if (!state.supportColumnReady.get()) {
                    throw new BadSqlGrammarException("scheduled order query", "SELECT support_status FROM payment_orders",
                            new SQLSyntaxErrorException("Unknown column 'support_status' in 'field list'"));
                }
                return List.of();
            }
            return RETURNS_DEFAULTS.answer(invocation);
        }));
    }

    private JdbcTemplate schemaJdbc(StartupState state) {
        return mock(JdbcTemplate.class, invocation -> {
            String method = invocation.getMethod().getName();
            if (!List.of("execute", "update", "query", "queryForObject", "queryForList").contains(method)) {
                return RETURNS_DEFAULTS.answer(invocation);
            }
            if (state.schemaCalls.getAndIncrement() == 0) {
                state.schemaEntered.countDown();
                if (!state.releaseSchema.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("schema test barrier timed out");
                if (state.failSchema) throw new DataAccessResourceFailureException("schema migration fixture failure");
            }
            Object[] arguments = invocation.getArguments();
            if (method.equals("queryForObject") && arguments.length > 1 && arguments[1] == Integer.class) {
                return Arrays.asList(arguments).contains("support_status") && !state.supportColumnReady.get() ? 0 : 1;
            }
            if (method.equals("execute") && arguments[0] instanceof String sql
                    && sql.startsWith("ALTER TABLE payment_orders ADD COLUMN support_status")) {
                state.supportColumnReady.set(true);
            }
            return RETURNS_DEFAULTS.answer(invocation);
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableScheduling
    @Import({DatabaseSchemaInitializer.class, AlipayFaceToFacePaymentService.class})
    static class StartupConfiguration {
        @Bean
        ThreadPoolTaskScheduler taskScheduler(StartupState state) {
            ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
            scheduler.setPoolSize(1);
            scheduler.setThreadNamePrefix("schema-startup-test-");
            scheduler.setErrorHandler(state.schedulingErrors::add);
            return scheduler;
        }
    }

    static class StartupState {
        final CountDownLatch schemaEntered = new CountDownLatch(1);
        final CountDownLatch releaseSchema = new CountDownLatch(1);
        final CountDownLatch scheduledQuery = new CountDownLatch(1);
        final AtomicBoolean supportColumnReady = new AtomicBoolean();
        final AtomicInteger schemaCalls = new AtomicInteger();
        final AtomicInteger scheduledCalls = new AtomicInteger();
        final AtomicInteger readyEvents = new AtomicInteger();
        final List<Throwable> schedulingErrors = new CopyOnWriteArrayList<>();
        boolean failSchema;
    }
}
