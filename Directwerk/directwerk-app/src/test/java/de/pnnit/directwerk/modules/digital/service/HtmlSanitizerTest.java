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
    void allowsNewsletterFormattingTags() {
        String sanitized = htmlSanitizer.sanitize("""
                <blockquote><p>Quoted <s>old</s> line</p></blockquote>
                <hr>
                <p>After the break</p>
                """);

        assertThat(sanitized).contains("<blockquote>");
        assertThat(sanitized).contains("<s>old</s>");
        assertThat(sanitized).contains("<hr");
        assertThat(sanitized).contains("After the break");
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

    @Test
    void convertsCommonMarkToSanitizedHtml() {
        String sanitized = htmlSanitizer.sanitize("""
                # WoW Classic Leveling Guide

                A walkthrough from levels **1–60**.

                > Level ranges are community guidance.

                ## How to use this guide

                1. Pick your faction
                2. Open each zone article

                See [overview](/en/a/forever-wow-forever-overview).
                """);

        assertThat(sanitized).contains("<h2>WoW Classic Leveling Guide</h2>");
        assertThat(sanitized).contains("<strong>1–60</strong>");
        assertThat(sanitized).contains("<blockquote>");
        assertThat(sanitized).contains("<h2>How to use this guide</h2>");
        assertThat(sanitized).contains("<ol>");
        assertThat(sanitized).contains("href=\"/en/a/forever-wow-forever-overview\"");
        assertThat(sanitized).doesNotContain("# WoW");
        assertThat(sanitized).doesNotContain("**1–60**");
    }

    @Test
    void convertsEntityEscapedMarkdownBeforeRendering() {
        String sanitized = htmlSanitizer.sanitize(
                "# Alliance &amp; Horde\n\n&gt; Move on when quests turn green.\n\n"
                        + "Blizzard&#39;s Forever launch.");

        assertThat(sanitized).contains("<h2>Alliance &amp; Horde</h2>");
        assertThat(sanitized).contains("<blockquote>");
        assertThat(sanitized).contains("Move on when quests turn green.");
        // Apostrophe may be re-encoded by OWASP as &#39; in text nodes.
        assertThat(sanitized).contains("Blizzard");
        assertThat(sanitized).contains("Forever launch.");
        assertThat(sanitized).doesNotContain("&gt;");
    }

    @Test
    void stripsScriptFromMarkdownHtmlPassthrough() {
        String sanitized = htmlSanitizer.sanitize("Hello <script>alert(1)</script> **there**");

        assertThat(sanitized).contains("<strong>there</strong>");
        assertThat(sanitized).doesNotContain("<script>");
        assertThat(sanitized).doesNotContain("alert");
    }

    @Test
    void convertsMarkdownThatEmbedsInlineHtml() {
        String sanitized = htmlSanitizer.sanitize("""
                # Title

                See <a href="https://x.test">x</a> for **y**.
                """);

        assertThat(sanitized).contains("<h2>Title</h2>");
        assertThat(sanitized).contains("<strong>y</strong>");
        assertThat(sanitized).contains("href=\"https://x.test\"");
        assertThat(sanitized).doesNotContain("# Title");
        assertThat(sanitized).doesNotContain("**y**");
    }

    @Test
    void invalidNumericEntitiesDoNotThrow() {
        String sanitized = htmlSanitizer.sanitize("# ok\n\n&#x110000;\n\n&#999999999;");

        assertThat(sanitized).contains("<h2>ok</h2>");
        assertThat(sanitized).doesNotContain("# ok");
    }

    @Test
    void convertsGfmMarkdownTablesToHtml() {
        String sanitized = htmlSanitizer.sanitize("""
                ## Quests

                | Quest | Where | Faction |
                |---|---|---|
                | The Defias Brotherhood | Westfall | Alliance |
                | Red Silk Bandanas | Westfall | Alliance |
                """);

        assertThat(sanitized).contains("<h2>Quests</h2>");
        assertThat(sanitized).contains("<table>");
        assertThat(sanitized).contains("<thead>");
        assertThat(sanitized).contains("<th>Quest</th>");
        assertThat(sanitized).contains("<td>The Defias Brotherhood</td>");
        assertThat(sanitized).doesNotContain("| Quest |");
        assertThat(sanitized).doesNotContain("|---|");
    }

    @Test
    void preservesAlignedTableCells() {
        String sanitized = htmlSanitizer.sanitize("""
                | L | C | R |
                |:---|:---:|---:|
                | a | b | c |
                """);

        assertThat(sanitized).contains("<table>");
        assertThat(sanitized).contains("align=\"left\"");
        assertThat(sanitized).contains("align=\"center\"");
        assertThat(sanitized).contains("align=\"right\"");
    }

    @Test
    void allowsPreRenderedTableHtml() {
        String sanitized = htmlSanitizer.sanitize("""
                <h2>Quests</h2>
                <table><thead><tr><th>Quest</th><th>Where</th></tr></thead>
                <tbody><tr><td>Defias</td><td>Westfall</td></tr></tbody></table>
                """);

        assertThat(sanitized).contains("<table>");
        assertThat(sanitized).contains("<th>Quest</th>");
        assertThat(sanitized).contains("<td>Defias</td>");
    }
}
