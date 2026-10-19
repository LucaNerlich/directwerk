package de.pnnit.directwerk.modules.digital.importing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class RssXmlWriterTest {

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
    void escapeTextStripsXmlInvalidControlCharacters() {
        assertThat(RssXmlWriter.escapeText("AB\u0001C\u000BD\u000CE\u001FF")).isEqualTo("ABCDEF");
    }
}
