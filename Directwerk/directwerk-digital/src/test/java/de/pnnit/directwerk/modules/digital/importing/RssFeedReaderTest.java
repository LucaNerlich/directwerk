package de.pnnit.directwerk.modules.digital.importing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.exception.RssFeedImportException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class RssFeedReaderTest {

    @Test
    void keepsEveryEnclosureSoEachModuleCanPickItsOwn() {
        String xml = """
                <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
                  <channel>
                    <title>Shared</title>
                    <language>de-DE</language>
                    <itunes:category text="News"/>
                    <item>
                      <title>Entry</title>
                      <link>/posts/entry</link>
                      <description>Teaser</description>
                      <guid>g1</guid>
                      <pubDate>Mon, 20 Jul 2026 12:00:00 GMT</pubDate>
                      <enclosure url="https://cdn.example.com/cover.jpg" length="100" type="image/jpeg"/>
                      <enclosure url="https://cdn.example.com/ep.mp3" length="200" type="audio/mpeg"/>
                      <itunes:duration>01:02:03</itunes:duration>
                      <itunes:episode>2</itunes:episode>
                      <itunes:image href="https://cdn.example.com/ep.jpg"/>
                    </item>
                  </channel>
                </rss>
                """;

        ParsedRssDocument document = RssFeedReader.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        );

        assertThat(document.channel().title()).isEqualTo("Shared");
        assertThat(document.channel().language()).isEqualTo("de-DE");
        assertThat(document.channel().itunesCategory()).isEqualTo("News");
        ParsedRssDocument.Item item = document.items().getFirst();
        assertThat(item.link()).isEqualTo("/posts/entry");
        assertThat(item.enclosures()).containsExactly(
                new ParsedRssDocument.Enclosure("https://cdn.example.com/cover.jpg", "image/jpeg", 100L),
                new ParsedRssDocument.Enclosure("https://cdn.example.com/ep.mp3", "audio/mpeg", 200L)
        );
        assertThat(item.durationSeconds()).isEqualTo(3723);
        assertThat(item.episodeNumber()).isEqualTo(2);
        assertThat(item.imageUrl()).isEqualTo("https://cdn.example.com/ep.jpg");
    }

    @Test
    void rejectsFeedWithoutChannelTitle() {
        String xml = "<rss><channel><item><title>X</title></item></channel></rss>";

        assertThatThrownBy(() -> RssFeedReader.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        )).isInstanceOf(RssFeedImportException.class)
                .extracting("code")
                .isEqualTo("RSS_FEED_INVALID");
    }
}
