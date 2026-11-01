package de.pnnit.directwerk.modules.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SearchPlainTextTest {

    @Test
    void stripsTagsCollapsesWhitespaceAndDecodesEntities() {
        String plain = SearchPlainText.fromHtml("<p>O&#39;Brien&nbsp;&amp; <strong>quoted</strong></p>");

        assertThat(plain).isEqualTo("O'Brien & quoted");
        assertThat(plain).doesNotContain("<");
    }

    @Test
    void capsLongBodies() {
        String plain = SearchPlainText.fromHtml("a".repeat(SearchPlainText.MAX_CHARS + 50));

        assertThat(plain).hasSize(SearchPlainText.MAX_CHARS);
    }

    @Test
    void excerptPrefersAuthorTextThenBodyPrefix() {
        assertThat(SearchPlainText.excerpt("<em>Teaser</em>", "full body")).isEqualTo("Teaser");
        assertThat(SearchPlainText.excerpt("  ", "x".repeat(200))).hasSize(SearchPlainText.EXCERPT_CHARS);
        assertThat(SearchPlainText.excerpt(null, null)).isEmpty();
    }
}
