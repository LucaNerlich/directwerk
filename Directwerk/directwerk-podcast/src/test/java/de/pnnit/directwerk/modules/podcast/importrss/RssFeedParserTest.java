package de.pnnit.directwerk.modules.podcast.importrss;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class RssFeedParserTest {

    private final RssFeedParser parser = new RssFeedParser();

    @Test
    void parsesChannelAndItunesEpisodeFields() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
                  <channel>
                    <title>Alpha Show</title>
                    <description>About the show</description>
                    <language>de-DE</language>
                    <link>https://example.com</link>
                    <itunes:category text="News"/>
                    <itunes:image href="https://cdn.example.com/show.jpg"/>
                    <item>
                      <title>Folge 2</title>
                      <description>&lt;p&gt;Shownotes&lt;/p&gt;</description>
                      <guid isPermaLink="false">guid-2</guid>
                      <pubDate>Mon, 20 Jul 2026 12:00:00 GMT</pubDate>
                      <enclosure url="https://cdn.example.com/ep2.mp3" length="12345" type="audio/mpeg"/>
                      <itunes:duration>01:02:03</itunes:duration>
                      <itunes:episode>2</itunes:episode>
                      <itunes:image href="https://cdn.example.com/ep2.jpg"/>
                    </item>
                    <item>
                      <title>Folge 1</title>
                      <guid>guid-1</guid>
                      <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg"/>
                    </item>
                  </channel>
                </rss>
                """;

        ParsedRssFeed feed = parser.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        );

        assertThat(feed.channel().title()).isEqualTo("Alpha Show");
        assertThat(feed.channel().language()).isEqualTo("de-DE");
        assertThat(feed.channel().itunesCategory()).isEqualTo("News");
        assertThat(feed.channel().imageUrl()).isEqualTo("https://cdn.example.com/show.jpg");
        assertThat(feed.items()).hasSize(2);
        assertThat(feed.items().getFirst().guid()).isEqualTo("guid-2");
        assertThat(feed.items().getFirst().durationSeconds()).isEqualTo(3723);
        assertThat(feed.items().getFirst().episodeNumber()).isEqualTo(2);
        assertThat(feed.items().getFirst().audioUrl()).isEqualTo("https://cdn.example.com/ep2.mp3");
        assertThat(feed.items().getFirst().imageUrl()).isEqualTo("https://cdn.example.com/ep2.jpg");
    }

    @Test
    void rejectsFeedWithoutChannelTitle() {
        String xml = """
                <rss><channel><item><title>X</title></item></channel></rss>
                """;
        assertThatThrownBy(() -> parser.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        )).isInstanceOf(RssImportException.class)
                .extracting("code")
                .isEqualTo("RSS_FEED_INVALID");
    }

    @Test
    void parsesItunesDurationAsSeconds() {
        assertThat(RssFeedParser.parseDuration("90")).isEqualTo(90);
        assertThat(RssFeedParser.parseDuration("1:02")).isEqualTo(62);
        assertThat(RssFeedParser.parseDuration("")).isNull();
    }
}
