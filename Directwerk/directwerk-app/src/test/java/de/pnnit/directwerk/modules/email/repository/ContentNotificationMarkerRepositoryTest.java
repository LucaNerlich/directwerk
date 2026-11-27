package de.pnnit.directwerk.modules.email.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** #1035: the ON CONFLICT claim is the fan-out idempotency gate, so it must be atomic. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class ContentNotificationMarkerRepositoryTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    private ContentNotificationMarkerRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @DynamicPropertySource
    static void registerSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.queue.enabled", () -> "false");
        registry.add("spring.quartz.auto-startup", () -> "false");
    }

    @BeforeEach
    void seed() {
        jdbcTemplate.update("INSERT INTO tenants (id, slug, name) VALUES (10, 'tenant-10', 'Tenant 10') ON CONFLICT (id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO users (id, email) VALUES (20, 'marker@example.com') ON CONFLICT (id) DO NOTHING");
        jdbcTemplate.update("DELETE FROM content_notification_markers");
        jdbcTemplate.update("DELETE FROM newsletter_notification_markers");
    }

    @Test
    void claimIsAtomicPerTuple() {
        assertThat(repository.claim(10L, "EPISODE", 30L, 20L)).isTrue();
        assertThat(repository.claim(10L, "EPISODE", 30L, 20L)).isFalse();
        assertThat(repository.claimNewsletterRecipient(10L, 30L, "marker@example.com")).isTrue();
        assertThat(repository.claimNewsletterRecipient(10L, 30L, "marker@example.com")).isFalse();
    }

    @Test
    void claimRollsBackWithTheCallerTransaction() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            repository.claim(10L, "EPISODE", 30L, 20L);
            repository.claimNewsletterRecipient(10L, 30L, "marker@example.com");
            status.setRollbackOnly();
        });

        assertThat(repository.exists(10L, "EPISODE", 30L, 20L)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM newsletter_notification_markers WHERE tenant_id = 10",
                Integer.class
        )).isZero();
    }
}
