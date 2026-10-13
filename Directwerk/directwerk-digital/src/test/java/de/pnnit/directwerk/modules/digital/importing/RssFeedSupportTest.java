package de.pnnit.directwerk.modules.digital.importing;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RssFeedSupportTest {

    @Test
    void truncateKeepsShortValuesAndBoundsLongOnes() {
        assertThat(RssFeedSupport.truncate(null, 5)).isNull();
        assertThat(RssFeedSupport.truncate("abc", 5)).isEqualTo("abc");
        assertThat(RssFeedSupport.truncate("abcdefgh", 4)).isEqualTo("abcd");
    }

    @Test
    void blankToNullTrimsAndDropsBlanks() {
        assertThat(RssFeedSupport.blankToNull(null)).isNull();
        assertThat(RssFeedSupport.blankToNull("   ")).isNull();
        assertThat(RssFeedSupport.blankToNull("  x  ")).isEqualTo("x");
    }

    @Test
    void firstNonBlankPrefersTheFirstPresentValue() {
        assertThat(RssFeedSupport.firstNonBlank(null, "b")).isEqualTo("b");
        assertThat(RssFeedSupport.firstNonBlank("  ", "b")).isEqualTo("b");
        assertThat(RssFeedSupport.firstNonBlank("a", "b")).isEqualTo("a");
    }

    @Test
    void normalizeLanguageDefaultsAndBounds() {
        assertThat(RssFeedSupport.normalizeLanguage(null)).isEqualTo("de");
        assertThat(RssFeedSupport.normalizeLanguage("  ")).isEqualTo("de");
        assertThat(RssFeedSupport.normalizeLanguage("de-DE")).isEqualTo("de-DE");
        assertThat(RssFeedSupport.normalizeLanguage("123456789")).isEqualTo("12345678");
    }

    @Test
    void boundedGuidKeepsShortValuesAndDigestsLongOnes() {
        assertThat(RssFeedSupport.boundedGuid("guid-1")).isEqualTo("guid-1");

        String longGuid = "g".repeat(600);
        String bounded = RssFeedSupport.boundedGuid(longGuid);
        assertThat(bounded).startsWith("sha256:");
        assertThat(bounded.substring("sha256:".length())).hasSize(64);
        assertThat(bounded).isEqualTo("sha256:" + RssFeedSupport.sha256Hex(longGuid));
    }

    @Test
    void sha256HexMatchesTheKnownEmptyDigest() {
        assertThat(RssFeedSupport.sha256Hex(""))
                .isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    @Test
    void resolveHttpUrlResolvesRelativeValuesAndRejectsUnsupportedSchemes() {
        assertThat(RssFeedSupport.resolveHttpUrl("https://example.com/feed.xml", "/a.mp3"))
                .isEqualTo("https://example.com/a.mp3");
        assertThat(RssFeedSupport.resolveHttpUrl("https://example.com/feed.xml", "ftp://x/a.mp3"))
                .isNull();
        assertThat(RssFeedSupport.resolveHttpUrl("https://example.com/feed.xml", "   ")).isNull();
    }
}
