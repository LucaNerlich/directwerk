package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins the public feed URL grammar against {@code RssFeedController}'s route mappings —
 * a drift between the two ships broken links to podcatchers.
 */
class FeedUrlsTest {

    @Test
    void tenantPodcastFeedMatchesControllerMapping() {
        assertThat(FeedUrls.tenantPodcastFeed("https://alpha.example.test", "alpha"))
                .isEqualTo("https://alpha.example.test/feeds/alpha/podcast.xml");
    }

    @Test
    void seriesFeedMatchesControllerMapping() {
        assertThat(FeedUrls.seriesFeed("http://localhost:8080", "alpha", "main-show"))
                .isEqualTo("http://localhost:8080/feeds/alpha/main-show.xml");
    }

    @Test
    void subscriberFeedMatchesTokenRoute() {
        assertThat(FeedUrls.subscriberFeed("https://alpha.example.test", "alpha", "tok_123"))
                .isEqualTo("https://alpha.example.test/feeds/alpha/u/tok_123.xml");
    }
}
