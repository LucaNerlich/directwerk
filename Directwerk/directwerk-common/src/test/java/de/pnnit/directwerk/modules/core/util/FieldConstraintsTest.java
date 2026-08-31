package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class FieldConstraintsTest {

    @Test
    void requirePositivePassesThroughNull() {
        assertThat(FieldConstraints.requirePositive(null, "sortOrder")).isNull();
    }

    @Test
    void requirePositiveRejectsZeroAndNegative() {
        assertThatThrownBy(() -> FieldConstraints.requirePositive(0, "sortOrder"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sortOrder");
        assertThatThrownBy(() -> FieldConstraints.requirePositive(-1, "sortOrder"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requirePositiveAcceptsPositive() {
        assertThat(FieldConstraints.requirePositive(1, "sortOrder")).isEqualTo(1);
    }

    @Test
    void requireNonNegativePassesThroughNull() {
        assertThat(FieldConstraints.requireNonNegative(null, "count")).isNull();
    }

    @Test
    void requireNonNegativeRejectsNegative() {
        assertThatThrownBy(() -> FieldConstraints.requireNonNegative(-1, "count"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("count");
    }

    @Test
    void requireNonNegativeAcceptsZeroAndPositive() {
        assertThat(FieldConstraints.requireNonNegative(0, "count")).isEqualTo(0);
        assertThat(FieldConstraints.requireNonNegative(5, "count")).isEqualTo(5);
    }
}
