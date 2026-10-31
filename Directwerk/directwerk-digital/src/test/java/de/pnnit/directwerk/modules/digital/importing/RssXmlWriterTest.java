package de.pnnit.directwerk.modules.digital.importing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import java.io.StringReader;
import java.time.Instant;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.xml.sax.InputSource;

class RssXmlWriterTest {

    private final HtmlSanitizer htmlSanitizer = new HtmlSanitizer();

    @Test
    void rendersAPlainFeedWhenItunesIsOff() {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Articles", "https://example.com", "Tenant", "de", false, null, false, null, null);
        List<String> entries = List.of("entry-1");

        String xml = RssXmlWriter.build(
                channel,
                entries,
                entry -> new RssXmlWriter.Item(
                        "Entry",
                        "https://example.com/articles/entry",
                        "<p>Body</p>",
                        "urn:directwerk:article:alpha:1",
                        Instant.parse("2026-01-01T00:00:00Z"),
                        null,
                        null,
                        null,
                        null
                ),
                value -> value == null ? "" : value
        );

        assertThat(xml).doesNotContain("xmlns:itunes");
        assertThat(xml).doesNotContain("itunes:");
        assertThat(xml).contains("<description><![CDATA[<p>Body</p>]]></description>");
        assertThat(xml).contains("<guid isPermaLink=\"false\">urn:directwerk:article:alpha:1</guid>");
        assertThat(xml).doesNotContain("<enclosure");
    }

    @Test
    void boundsDescriptionsOnlyWhenALimitIsSet() {
        RssXmlWriter.Channel bounded = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Tenant", "de", true, null, false, null, 5);
        RssXmlWriter.Channel unbounded = new RssXmlWriter.Channel(
                "Articles", "https://example.com", "Tenant", "de", false, null, false, null, null);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", "0123456789", "guid", null, null, null, null, null);

        assertThat(RssXmlWriter.build(bounded, List.of(item), entry -> item, value -> value))
                .contains("<description><![CDATA[01234]]></description>");
        assertThat(RssXmlWriter.build(unbounded, List.of(item), entry -> item, value -> value))
                .contains("<description><![CDATA[0123456789]]></description>");
    }

    @Test
    void truncatesDescriptionsAtATagBoundaryInsteadOfMidTag() {
        // Issue #589: 40 chars lands inside `<a href=...`; the cut must stay outside the tag.
        String html = "<p>" + "x".repeat(30) + "</p><a href=\"/very-long-link\">link</a>";
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Tenant", "de", true, null, false, null, 40);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", html, "guid", null, null, null, null, null);

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, value -> value);

        assertThat(xml).contains("<description><![CDATA[<p>" + "x".repeat(30) + "</p>]]></description>");
        assertThat(xml).doesNotContain("<a href=");
    }

    @Test
    void truncationNeverSplitsAnEntityOrSurrogatePair() {
        assertThat(RssXmlWriter.truncateHtml("a&amp;b", 5)).isEqualTo("a");
        assertThat(RssXmlWriter.truncateHtml("ab\uD83D\uDE00cd", 3)).isEqualTo("ab");
    }

    @Test
    void keepsLongSingleElementDescriptionsUpToTheCap() {
        String html = "<p>" + "x".repeat(5000) + "</p>";

        String truncated = RssXmlWriter.truncateHtml(html, 4000);

        assertThat(truncated).hasSize(4000);
        assertThat(truncated).isEqualTo("<p>" + "x".repeat(3997));
    }

    @Test
    void dropsAPartialFirstTagInsteadOfEmittingIt() {
        String html = "<a href=\"" + "u".repeat(100) + "\">link</a>";

        assertThat(RssXmlWriter.truncateHtml(html, 40)).isEmpty();
        assertThat(RssXmlWriter.truncateHtml("text<em>x</em>", 5)).isEqualTo("text");
    }

    @Test
    void escapeTextStripsXmlInvalidControlCharacters() {
        assertThat(RssXmlWriter.escapeText("AB\u0001C\u000BD\u000CE\u001FF")).isEqualTo("ABCDEF");
    }

    @Test
    void omitsOwnerTagsWhenContactEmailIsMissing() {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Tenant", "de", true, null, false, null, null);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", "body", "guid", null, null, null, null, null);

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, value -> value);

        assertThat(xml).doesNotContain("managingEditor");
        assertThat(xml).doesNotContain("webMaster");
        assertThat(xml).doesNotContain("itunes:owner");
        assertThat(xml).doesNotContain("itunes:email");
    }

    @Test
    void rendersRssAndItunesOwnerTagsFromTenantContact() {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast",
                "https://example.com",
                "Tenant",
                "de",
                true,
                null,
                false,
                null,
                null,
                "owner@example.com",
                "Alpha & Co"
        );
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", "body", "guid", null, null, null, null, null);

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, value -> value);

        assertThat(xml).contains("<managingEditor>owner@example.com (Alpha &amp; Co)</managingEditor>");
        assertThat(xml).contains("<webMaster>owner@example.com (Alpha &amp; Co)</webMaster>");
        assertThat(xml).contains("<itunes:owner>");
        assertThat(xml).contains("<itunes:name>Alpha &amp; Co</itunes:name>");
        assertThat(xml).contains("<itunes:email>owner@example.com</itunes:email>");
        assertThat(xml).contains("</itunes:owner>");
    }

    @Test
    void nonItunesFeedsStillEmitManagingEditorWhenEmailIsSet() {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Articles",
                "https://example.com",
                "Tenant",
                "de",
                false,
                null,
                false,
                null,
                null,
                "editor@example.com",
                "Tenant"
        );
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", "body", "guid", null, null, null, null, null);

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, value -> value);

        assertThat(xml).contains("<managingEditor>editor@example.com (Tenant)</managingEditor>");
        assertThat(xml).doesNotContain("itunes:owner");
    }

    @Test
    void cdataWrapsSanitizedShowNotesWithDecodedCosmeticEntities() {
        String showNotes = "<p>A &amp; B &#61; C &#64;host +1 Blizzard&#39;s &#96;tick&#96;</p>";
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Channel notes", "de", true, null, false, null, 4_000);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Ep = 1 @live",
                "https://example.com/e",
                showNotes,
                "guid",
                Instant.parse("2026-01-01T00:00:00Z"),
                null,
                "https://example.com/e.mp3",
                12L,
                "audio/mpeg"
        );

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, htmlSanitizer::sanitize);

        assertThat(xml).contains(
                "<description><![CDATA[<p>A &amp; B = C @host +1 Blizzard's `tick`</p>]]></description>");
        assertThat(xml).doesNotContain("&#61;");
        assertThat(xml).doesNotContain("&#64;");
        assertThat(xml).doesNotContain("&#39;");
        assertThat(xml).contains("<title>Ep = 1 @live</title>");
        assertThatXmlIsWellFormed(xml);
    }

    @Test
    void cdataKeepsAmpAndGtEncodedSoXmlStaysWellFormed() {
        // OWASP turns '>' into '&gt;', so a literal ']]>' in show notes becomes ']]&gt;'
        // inside CDATA (no terminator split needed). Raw '&' stays '&amp;'.
        String showNotes = "<p>A & B <tag> ]]></p><script>alert(1)</script>";
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Tenant", "de", true, null, false, null, null);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry", "https://example.com/e", showNotes, "guid", null, null, null, null, null);

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, htmlSanitizer::sanitize);

        assertThat(xml).contains(
                "<description><![CDATA[<p>A &amp; B  ]]&gt;</p>]]></description>");
        assertThat(xml).doesNotContain("<script");
        assertThat(xml).doesNotContain("alert");
        assertThatXmlIsWellFormed(xml);
    }

    @Test
    void cdataSplitsLiteralTerminatorWhenPresentInSanitizedHtml() {
        // Bypass HtmlSanitizer so the CDATA path is tested with a real ']]>' sequence
        // (OWASP would have encoded the '>').
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast", "https://example.com", "Tenant", "de", true, null, false, null, null);
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry",
                "https://example.com/e",
                "<p>before ]]> after</p>",
                "guid",
                null,
                null,
                null,
                null,
                null
        );

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, value -> value);

        assertThat(xml).contains(
                "<description><![CDATA[<p>before ]]]]><![CDATA[> after</p>]]></description>");
        assertThatXmlIsWellFormed(xml);
    }

    @Test
    void channelAndItemDescriptionsShareCdataPathThroughHtmlSanitizer() {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                "Podcast",
                "https://example.com",
                "<p>Channel &#64;notes a&#61;1</p><script>x</script>",
                "de",
                true,
                null,
                false,
                null,
                4_000
        );
        RssXmlWriter.Item item = new RssXmlWriter.Item(
                "Entry",
                "https://example.com/e",
                "<p>Item &#64;notes a&#61;1</p>",
                "guid",
                null,
                null,
                null,
                null,
                null
        );

        String xml = RssXmlWriter.build(channel, List.of(item), entry -> item, htmlSanitizer::sanitize);

        assertThat(xml).contains("<description><![CDATA[<p>Channel @notes a=1</p>]]></description>");
        assertThat(xml).contains("<description><![CDATA[<p>Item @notes a=1</p>]]></description>");
        assertThat(xml).doesNotContain("<script");
        assertThatXmlIsWellFormed(xml);
    }

    @Test
    void cdataHelperSplitsTerminatorWithoutEscapingDecodedContent() {
        assertThat(RssXmlWriter.cdata("<p>a=b @c 'd'</p>"))
                .isEqualTo("<![CDATA[<p>a=b @c 'd'</p>]]>");
        assertThat(RssXmlWriter.cdata("pre]]>post"))
                .isEqualTo("<![CDATA[pre]]]]><![CDATA[>post]]>");
    }

    private static void assertThatXmlIsWellFormed(String xml) {
        assertThatCode(() -> {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
        }).doesNotThrowAnyException();
    }
}
