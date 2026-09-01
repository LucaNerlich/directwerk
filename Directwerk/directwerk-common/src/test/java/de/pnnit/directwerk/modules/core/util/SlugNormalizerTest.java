package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SlugNormalizerTest {

    @Test
    void trimsAndLowercases() {
        assertThat(SlugNormalizer.normalize("  My-Show  ")).isEqualTo("my-show");
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> SlugNormalizer.normalize(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsSpaces() {
        assertThatThrownBy(() -> SlugNormalizer.normalize("my show"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsLeadingOrTrailingHyphen() {
        assertThatThrownBy(() -> SlugNormalizer.normalize("-my-show"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SlugNormalizer.normalize("my-show-"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOverlongSlug() {
        assertThatThrownBy(() -> SlugNormalizer.normalize("a".repeat(65)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsSingleCharacterSlug() {
        assertThat(SlugNormalizer.normalize("a")).isEqualTo("a");
    }
}
