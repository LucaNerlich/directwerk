package de.pnnit.directwerk.testsupport;

import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * H2 compatibility shims for the JVM-typical {@code test} profile.
 *
 * <p>{@code TenantMembershipManagementService} serialises role transitions with Postgres'
 * {@code pg_advisory_xact_lock}; H2 has no such function, so full-stack tests touching role
 * updates fail with SQLGrammarException. The alias installed here is a no-op stand-in —
 * serialisation semantics are exercised against real Postgres by the full-stack ITs.
 */
@Configuration
@Profile("test")
public class H2CompatibilityConfig {

    private static final Logger log = LoggerFactory.getLogger(H2CompatibilityConfig.class);

    /** No-op stand-in matching Postgres' two-argument transaction-scoped advisory lock. */
    public static long advisoryLock(long key1, long key2) {
        return 1L;
    }

    @Bean
    ApplicationRunner h2AdvisoryLockAlias(DataSource dataSource) {
        return (ApplicationArguments args) -> {
            try (Connection connection = dataSource.getConnection();
                 Statement statement = connection.createStatement()) {
                String product = connection.getMetaData().getDatabaseProductName();
                if (product == null || !product.toLowerCase().contains("h2")) {
                    return;
                }
                statement.execute("CREATE ALIAS IF NOT EXISTS \"pg_advisory_xact_lock\" FOR \""
                        + H2CompatibilityConfig.class.getName() + ".advisoryLock\"");
                log.info("Installed H2 no-op alias for pg_advisory_xact_lock");
            } catch (Exception ex) {
                log.warn("Could not install H2 pg_advisory_xact_lock alias: {}", ex.getMessage());
            }
        };
    }
}
