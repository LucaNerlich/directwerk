package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class SubscriberFeedServiceConcurrencyIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private SubscriberFeedService subscriberFeedService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @Test
    void concurrentTransactionsReturnTheSameDefaultFeed() throws Exception {
        Fixture fixture = insertFixture();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        Future<SubscriberFeed> first = executor.submit(() -> ensureAfterStart(fixture, start));
        Future<SubscriberFeed> second = executor.submit(() -> ensureAfterStart(fixture, start));

        try {
            transactionTemplate.executeWithoutResult(status -> {
                jdbcTemplate.execute("LOCK TABLE subscriber_feeds IN SHARE MODE");
                start.countDown();
                assertThatThrownBy(() -> first.get(300, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
                assertThatThrownBy(() -> second.get(300, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            });

            SubscriberFeed firstResult = first.get(10, TimeUnit.SECONDS);
            SubscriberFeed secondResult = second.get(10, TimeUnit.SECONDS);

            assertThat(firstResult.getId()).isEqualTo(secondResult.getId());
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM subscriber_feeds WHERE tenant_id = ? AND user_id = ? AND is_default",
                    Integer.class,
                    fixture.tenantId(),
                    fixture.userId())).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    private SubscriberFeed ensureAfterStart(Fixture fixture, CountDownLatch start) throws Exception {
        assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
        TenantContext.setTenantId(fixture.tenantId());
        try {
            return subscriberFeedService.ensureDefaultFeed(fixture.tenantId(), fixture.userId());
        } finally {
            TenantContext.clear();
        }
    }

    private Fixture insertFixture() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long tenantId = jdbcTemplate.queryForObject(
                "INSERT INTO tenants (slug, name, status) VALUES (?, ?, 'ACTIVE') RETURNING id",
                Long.class,
                "feed-race-" + suffix,
                "Feed Race " + suffix);
        long userId = jdbcTemplate.queryForObject(
                "INSERT INTO users (email, status) VALUES (?, 'ACTIVE') RETURNING id",
                Long.class,
                "feed-race-" + suffix + "@example.test");
        jdbcTemplate.update(
                "INSERT INTO tenant_memberships (tenant_id, user_id, roles, status) "
                        + "VALUES (?, ?, '[\"SUBSCRIBER\"]', 'ACTIVE')",
                tenantId,
                userId);
        return new Fixture(tenantId, userId);
    }

    private record Fixture(Long tenantId, Long userId) {
    }
}
