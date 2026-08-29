package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UmamiWebsiteIdValidatorTest {

    @Test
    void acceptsValidWebsiteIds() {
        assertThat(UmamiWebsiteIdValidator.isValid("abcd1234")).isTrue();
        assertThat(UmamiWebsiteIdValidator.isValid("  site-id-123  ")).isTrue();
        assertThat(UmamiWebsiteIdValidator.isValid("a".repeat(64))).isTrue();
    }

    @Test
    void rejectsInvalidWebsiteIds() {
        assertThat(UmamiWebsiteIdValidator.isValid(null)).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("")).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("   ")).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("short")).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("a".repeat(65))).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("bad id")).isFalse();
        assertThat(UmamiWebsiteIdValidator.isValid("bad/id")).isFalse();
    }

    @Test
    void normalizeTrimsAndBlankToNull() {
        assertThat(UmamiWebsiteIdValidator.normalize(null)).isNull();
        assertThat(UmamiWebsiteIdValidator.normalize("")).isNull();
        assertThat(UmamiWebsiteIdValidator.normalize("   ")).isNull();
        assertThat(UmamiWebsiteIdValidator.normalize("  site-id  ")).isEqualTo("site-id");
    }
}
