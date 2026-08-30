package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UmamiHostUrlValidatorTest {

    @Test
    void acceptsAbsoluteHttpsOrigin() {
        assertThat(UmamiHostUrlValidator.isValid("https://umami.lucanerlich.com")).isTrue();
        assertThat(UmamiHostUrlValidator.normalize("https://umami.lucanerlich.com/"))
                .isEqualTo("https://umami.lucanerlich.com");
    }

    @Test
    void rejectsNonHttpsAndMalformedUrls() {
        assertThat(UmamiHostUrlValidator.isValid("http://umami.example.test")).isFalse();
        assertThat(UmamiHostUrlValidator.isValid("https://umami.example.test/script.js")).isFalse();
        assertThat(UmamiHostUrlValidator.isValid("not-a-url")).isFalse();
        assertThat(UmamiHostUrlValidator.normalize("")).isNull();
    }
}
