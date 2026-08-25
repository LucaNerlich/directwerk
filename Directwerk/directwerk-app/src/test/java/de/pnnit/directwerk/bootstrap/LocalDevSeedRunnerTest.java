package de.pnnit.directwerk.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class LocalDevSeedRunnerTest {

    @Test
    void seedScriptIsOnClasspath() {
        assertThat(new ClassPathResource(LocalDevSeedRunner.SEED_SCRIPT).exists()).isTrue();
    }
}
