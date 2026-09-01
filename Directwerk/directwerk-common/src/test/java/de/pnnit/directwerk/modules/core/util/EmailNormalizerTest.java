package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EmailNormalizerTest {

    @Test
    void trimsAndLowercases() {
        assertThat(EmailNormalizer.normalize("  User@Example.COM  ")).isEqualTo("user@example.com");
    }

    @Test
    void rejectsBlank() {
        assertThatThrownBy(() -> EmailNormalizer.normalize("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> EmailNormalizer.normalize(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOverlongEmail() {
        String local = "a".repeat(EmailNormalizer.MAX_EMAIL_LENGTH);
        assertThatThrownBy(() -> EmailNormalizer.normalize(local + "@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
