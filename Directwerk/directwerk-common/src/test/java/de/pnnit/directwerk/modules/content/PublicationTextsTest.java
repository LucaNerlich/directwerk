package de.pnnit.directwerk.modules.content;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PublicationTextsTest {

    @Test
    void htmlExcerptDecodesEntitiesIntoPlainText() {
        // #742: the helper promised plain text but left entities in place, and the email
        // renderer escaped the ampersand again — recipients read "Tom &amp; Jerry".
        assertThat(PublicationTexts.htmlExcerpt("<p>Tom &amp; Jerry</p>"))
                .isEqualTo("Tom & Jerry");
    }

    @Test
    void htmlExcerptCollapsesNonBreakingSpaces() {
        assertThat(PublicationTexts.htmlExcerpt("<p>a&nbsp;b</p>"))
                .isEqualTo("a b");
    }

    @Test
    void htmlExcerptStillStripsTagsAndTruncates() {
        String longText = "<p>" + "x".repeat(400) + "</p>";

        String excerpt = PublicationTexts.htmlExcerpt(longText);

        assertThat(excerpt).doesNotContain("<p>").doesNotContain("</p>");
        assertThat(excerpt.length()).isLessThanOrEqualTo(280);
    }
}
