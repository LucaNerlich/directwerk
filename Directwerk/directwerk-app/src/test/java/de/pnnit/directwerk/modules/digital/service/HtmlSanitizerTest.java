package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HtmlSanitizerTest {

    private final HtmlSanitizer htmlSanitizer = new HtmlSanitizer();

    @Test
    void allowsPodcastShowNoteTagsAndStripsScripts() {
        String sanitized = htmlSanitizer.sanitize("""
                <h2>Intro</h2><p>Hello <strong>friend</strong><script>alert(1)</script></p>
                <ul><li><a href="https://example.test/episode">Link</a></li></ul>
                """);

        assertThat(sanitized).contains("<h2>Intro</h2>");
        assertThat(sanitized).contains("<strong>friend</strong>");
        assertThat(sanitized).contains("<a href=\"https://example.test/episode\">Link</a>");
        assertThat(sanitized).doesNotContain("script");
        assertThat(sanitized).doesNotContain("alert");
    }

    @Test
    void stripsUnsafeLinkProtocols() {
        String sanitized = htmlSanitizer.sanitize("<p><a href=\"javascript:alert(1)\">bad</a></p>");

        assertThat(sanitized).isEqualTo("<p>bad</p>");
        assertThat(sanitized).doesNotContain("javascript");
    }

    @Test
    void preservesTelLinks() {
        String sanitized = htmlSanitizer.sanitize("<p><a href=\"tel:+491234567890\">call</a></p>");

        assertThat(sanitized).contains("tel:");
        assertThat(sanitized).contains("call");
        assertThat(sanitized).doesNotContain("javascript");
    }

    @Test
    void allowsInlineImagesWithHttpsSrc() {
        String sanitized = htmlSanitizer.sanitize(
                "<p>Text</p><figure><img src=\"https://cdn.example.test/tenant/public/images/asset-1_cover.png\" alt=\"Cover\" /></figure>");

        assertThat(sanitized).contains("<img");
        assertThat(sanitized).contains("src=\"https://cdn.example.test/tenant/public/images/asset-1_cover.png\"");
        assertThat(sanitized).contains("alt=\"Cover\"");
    }

    @Test
    void stripsUnsafeImageSourcesAndHandlers() {
        String sanitized = htmlSanitizer.sanitize(
                "<p><img src=\"data:image/png;base64,AAA\" onerror=\"alert(1)\" alt=\"x\" />"
                        + "<img src=\"javascript:alert(1)\" alt=\"y\" /></p>");

        assertThat(sanitized).doesNotContain("data:");
        assertThat(sanitized).doesNotContain("javascript");
        assertThat(sanitized).doesNotContain("onerror");
    }
}
