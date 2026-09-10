package de.pnnit.directwerk.modules.newsletter.importrss;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ArticleRssFeedParserTest {

    private final ArticleRssFeedParser parser = new ArticleRssFeedParser();

    @Test
    void parsesContentEncodedImageEnclosureAndInlineFallback() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
                  <channel>
                    <title>M10Z</title>
                    <description>Articles</description>
                    <language>de</language>
                    <link>https://m10z.de</link>
                    <image>
                      <url>https://m10z.de/images/m10z.jpg</url>
                    </image>
                    <item>
                      <title>Crafting</title>
                      <description>Short teaser</description>
                      <content:encoded><![CDATA[<p>Full body</p><img src="https://cdn.example.com/inline.jpg"/>]]></content:encoded>
                      <guid isPermaLink="false">guid-1</guid>
                      <pubDate>Sat, 05 Sep 2026 13:30:00 GMT</pubDate>
                      <enclosure url="https://cms.m10z.de/uploads/cover.jpg" length="100" type="image/jpeg"/>
                    </item>
                    <item>
                      <title>No enclosure</title>
                      <description><![CDATA[<p>Only desc</p><img src="https://cdn.example.com/hero.webp"/>]]></description>
                      <guid>guid-2</guid>
                    </item>
                  </channel>
                </rss>
                """;

        ParsedArticleRssFeed feed = parser.parse(
                "https://m10z.de/rss.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        );

        assertThat(feed.channel().title()).isEqualTo("M10Z");
        assertThat(feed.channel().imageUrl()).isEqualTo("https://m10z.de/images/m10z.jpg");
        assertThat(feed.items()).hasSize(2);
        assertThat(feed.items().getFirst().guid()).isEqualTo("guid-1");
        assertThat(feed.items().getFirst().bodyHtml()).contains("Full body");
        assertThat(feed.items().getFirst().excerpt()).isEqualTo("Short teaser");
        assertThat(feed.items().getFirst().imageUrl()).isEqualTo("https://cms.m10z.de/uploads/cover.jpg");
        assertThat(feed.items().get(1).imageUrl()).isEqualTo("https://cdn.example.com/hero.webp");
    }

    @Test
    void rejectsFeedWithoutChannelTitle() {
        String xml = """
                <rss><channel><item><title>X</title></item></channel></rss>
                """;
        assertThatThrownBy(() -> parser.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        )).isInstanceOf(ArticleRssImportException.class)
                .extracting("code")
                .isEqualTo("RSS_FEED_INVALID");
    }

    @Test
    void ignoresAudioEnclosures() {
        String xml = """
                <rss version="2.0">
                  <channel>
                    <title>Blog</title>
                    <item>
                      <title>Post</title>
                      <guid>g1</guid>
                      <enclosure url="https://cdn.example.com/ep.mp3" type="audio/mpeg"/>
                      <enclosure url="https://cdn.example.com/cover.png" type="image/png"/>
                    </item>
                  </channel>
                </rss>
                """;
        ParsedArticleRssFeed feed = parser.parse(
                "https://example.com/feed.xml",
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))
        );
        assertThat(feed.items().getFirst().imageUrl()).isEqualTo("https://cdn.example.com/cover.png");
    }
}
