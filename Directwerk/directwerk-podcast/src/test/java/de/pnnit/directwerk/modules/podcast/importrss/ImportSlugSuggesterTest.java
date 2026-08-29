package de.pnnit.directwerk.modules.podcast.importrss;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ImportSlugSuggesterTest {

    @Test
    void suggestsAsciiSlugFromTitle() {
        assertThat(ImportSlugSuggester.suggest("Folge 12: Hello World")).isEqualTo("folge-12-hello-world");
    }

    @Test
    void foldsGermanUmlauts() {
        assertThat(ImportSlugSuggester.suggest("Über uns")).isEqualTo("ueber-uns");
    }

    @Test
    void fallsBackWhenTitleHasNoAscii() {
        assertThat(ImportSlugSuggester.suggest("Привет")).isEqualTo("folge");
    }

    @Test
    void suffixesWithoutExceedingSlugLength() {
        String base = "a".repeat(60);
        String suffixed = ImportSlugSuggester.withSuffix(base, 12);
        assertThat(suffixed).endsWith("-12");
        assertThat(suffixed.length()).isLessThanOrEqualTo(64);
    }
}
