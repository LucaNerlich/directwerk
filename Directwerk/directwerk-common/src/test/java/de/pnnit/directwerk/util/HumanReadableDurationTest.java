package de.pnnit.directwerk.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class HumanReadableDurationTest {

    @Test
    void formatsHours() {
        assertThat(HumanReadableDuration.format(Duration.ofHours(1))).isEqualTo("1 hour");
        assertThat(HumanReadableDuration.format(Duration.ofHours(24))).isEqualTo("24 hours");
    }
}
