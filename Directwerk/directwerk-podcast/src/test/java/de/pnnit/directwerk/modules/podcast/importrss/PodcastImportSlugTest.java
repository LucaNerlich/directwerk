package de.pnnit.directwerk.modules.podcast.importrss;

import de.pnnit.directwerk.modules.digital.importing.FeedImportSupport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PodcastImportSlugTest {

    @Test
    void suggestsAsciiSlugFromTitle() {
        assertThat(FeedImportSupport.suggestSlug("Folge 12: Hello World", "folge")).isEqualTo("folge-12-hello-world");
    }

    @Test
    void foldsGermanUmlauts() {
        assertThat(FeedImportSupport.suggestSlug("Über uns", "folge")).isEqualTo("ueber-uns");
    }

    @Test
    void fallsBackWhenTitleHasNoAscii() {
        assertThat(FeedImportSupport.suggestSlug("Привет", "folge")).isEqualTo("folge");
    }

    @Test
    void suffixesWithoutExceedingSlugLength() {
        String base = "a".repeat(60);
        String suffixed = FeedImportSupport.withSuffix(base, 12, "folge");
        assertThat(suffixed).endsWith("-12");
        assertThat(suffixed.length()).isLessThanOrEqualTo(64);
    }
}
