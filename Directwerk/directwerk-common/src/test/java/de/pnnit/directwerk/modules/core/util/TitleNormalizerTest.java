package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TitleNormalizerTest {

    @Test
    void trims() {
        assertThat(TitleNormalizer.normalize("  Hello World  ", "Episode")).isEqualTo("Hello World");
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> TitleNormalizer.normalize(null, "Episode"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Episode");
    }

    @Test
    void rejectsBlank() {
        assertThatThrownBy(() -> TitleNormalizer.normalize("   ", "Article"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Article");
    }

    @Test
    void rejectsOverlongTitle() {
        assertThatThrownBy(() -> TitleNormalizer.normalize("a".repeat(TitleNormalizer.MAX_TITLE_LENGTH + 1), "Episode"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsBoundaryLength() {
        String title = "a".repeat(TitleNormalizer.MAX_TITLE_LENGTH);
        assertThat(TitleNormalizer.normalize(title, "Episode")).isEqualTo(title);
    }
}
