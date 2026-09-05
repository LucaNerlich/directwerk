package de.pnnit.directwerk.modules.queue;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class QuartzJdbcStoreIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

    @Autowired
    JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerOAuthSecrets(DynamicPropertyRegistry registry) {
    }

    @Test
    void jdbcQuartzTablesExistAfterFlywayMigration() {
        List<String> expectedTables = List.of(
                "qrtz_job_details",
                "qrtz_triggers",
                "qrtz_calendars",
                "qrtz_cron_triggers",
                "qrtz_fired_triggers",
                "qrtz_locks",
                "qrtz_paused_trigger_grps",
                "qrtz_scheduler_state",
                "qrtz_simple_triggers",
                "qrtz_simprop_triggers",
                "qrtz_blob_triggers"
        );

        for (String tableName : expectedTables) {
            Integer tableCount = jdbcTemplate.queryForObject(
                    """
                    select count(*) from information_schema.tables
                    where table_schema = ? and table_name = ?
                    """,
                    Integer.class,
                    "public",
                    tableName
            );
            assertThat(tableCount)
                    .as("Table %s should exist", tableName)
                    .isEqualTo(1);
        }
    }
}
