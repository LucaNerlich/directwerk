package de.pnnit.directwerk.config;

import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

/**
 * Applies idempotent local tenant fixtures after Flyway, before {@link DevDataInitializer}.
 * Kept out of Flyway so profile switches and {@code flywayMigrate} do not fail validation
 * on a repeatable seed that is not on the production classpath.
 */
@Component
@Profile({"local", "docker"})
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class LocalDevSeedRunner implements ApplicationRunner {

    public static final String SEED_SCRIPT = "db/seed/alpha_dev_seed.sql";

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource(SEED_SCRIPT));
        populator.setSeparator(";");
        populator.execute(dataSource);
        log.info("Applied local development seed data");
    }
}
