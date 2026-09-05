package de.pnnit.directwerk;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.bootstrap.LocalDevSeedRunner;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the production schema workflow: Flyway owns migrations, Hibernate only validates.
 * Fails if a JPA entity and the Flyway scripts for the current status quo diverge.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class FlywaySchemaValidationIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:19beta2-alpine");

    @Autowired
    ConfigurableApplicationContext applicationContext;

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerOAuthSecrets(DynamicPropertyRegistry registry) {
    }

    @Test
    void flywayMigratesAndHibernateValidatesSchema() {
        assertThat(applicationContext.isActive()).isTrue();
    }

    @Test
    void podcastRssQueueMigrationRenamesPersistedJobs() {
        long renamedTenantId = 91_001L;
        long customCorrelationTenantId = 91_002L;
        jdbcTemplate.update(
                """
                INSERT INTO tenants (id, slug, name)
                VALUES
                    (?, 'queue-migration-1', 'Queue migration 1'),
                    (?, 'queue-migration-2', 'Queue migration 2')
                """,
                renamedTenantId,
                customCorrelationTenantId
        );

        UUID renamedJobId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO jobs (id, queue_name, payload, tenant_id, correlation_id, status)
                VALUES (?, 'rss-feed-refresh', '{}'::jsonb, ?, 'rss-feed-refresh-' || ?, 'COMPLETED')
                """,
                renamedJobId,
                renamedTenantId,
                renamedTenantId
        );

        String maxLengthCustomCorrelation = "rss-feed-refresh-" + "x".repeat(183);
        assertThat(maxLengthCustomCorrelation).hasSize(200);
        UUID customCorrelationJobId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO jobs (id, queue_name, payload, tenant_id, correlation_id, status)
                VALUES (?, 'rss-feed-refresh', '{}'::jsonb, ?, ?, 'COMPLETED')
                """,
                customCorrelationJobId,
                customCorrelationTenantId,
                maxLengthCustomCorrelation
        );

        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource(
                "db/migration/V57__rename_podcast_rss_feed_refresh_queue.sql"
        ));
        populator.execute(dataSource);

        assertThat(jdbcTemplate.queryForMap(
                "SELECT queue_name, correlation_id FROM jobs WHERE id = ?",
                renamedJobId
        )).containsEntry("queue_name", "podcast-rss-feed-refresh")
                .containsEntry("correlation_id", "podcast-rss-feed-refresh-" + renamedTenantId);
        assertThat(jdbcTemplate.queryForMap(
                "SELECT queue_name, correlation_id FROM jobs WHERE id = ?",
                customCorrelationJobId
        )).containsEntry("queue_name", "podcast-rss-feed-refresh")
                .containsEntry("correlation_id", maxLengthCustomCorrelation);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE queue_name = 'rss-feed-refresh'",
                Integer.class
        )).isZero();
    }

    @Test
    void localDevSeedSqlIsIdempotentAgainstCurrentSchema() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource(LocalDevSeedRunner.SEED_SCRIPT));
        populator.setSeparator(";");
        populator.execute(dataSource);
        populator.execute(dataSource);

        Integer tenantCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tenants WHERE slug IN ('alpha-show-a', 'alpha-show-b')",
                Integer.class);
        assertThat(tenantCount).isEqualTo(2);

        Integer devDomainCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM tenant_domains d
                JOIN tenants t ON t.id = d.tenant_id
                WHERE t.slug = 'alpha-show-a'
                  AND d.verified = TRUE
                  AND d.is_primary = FALSE
                  AND d.host IN ('localhost', '127.0.0.1')
                """,
                Integer.class);
        assertThat(devDomainCount).isEqualTo(2);

        Integer productCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM subscription_products p
                JOIN tenants t ON t.id = p.tenant_id
                WHERE t.slug = 'alpha-show-a' AND p.slug IN ('supporter', 'producer')
                """,
                Integer.class);
        assertThat(productCount).isEqualTo(2);
    }
}
