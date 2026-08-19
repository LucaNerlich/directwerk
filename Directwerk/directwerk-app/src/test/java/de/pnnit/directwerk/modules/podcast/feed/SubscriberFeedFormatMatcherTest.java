package de.pnnit.directwerk.modules.podcast.feed;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import org.junit.jupiter.api.Test;

class SubscriberFeedFormatMatcherTest {

    @Test
    void defaultFeedIncludesEveryEpisode() {
        SubscriberFeed feed = new SubscriberFeed();
        feed.setDefaultFeed(true);

        assertThat(SubscriberFeedFormatMatcher.includes(feed, new Episode())).isTrue();
    }

    @Test
    void customFeedMatchesWhenEpisodeHasSelectedActiveFormat() {
        Format interview = format(3L, true);
        Format bonus = format(8L, true);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setDefaultFeed(false);
        feed.getFormats().add(interview);

        Episode episode = new Episode();
        episode.getFormats().add(interview);
        episode.getFormats().add(bonus);

        assertThat(SubscriberFeedFormatMatcher.includes(feed, episode)).isTrue();
    }

    @Test
    void customFeedExcludesWhenSelectedFormatIsInactive() {
        Format interview = format(3L, false);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setDefaultFeed(false);
        feed.getFormats().add(interview);

        Episode episode = new Episode();
        episode.getFormats().add(interview);

        assertThat(SubscriberFeedFormatMatcher.includes(feed, episode)).isFalse();
    }

    @Test
    void customFeedExcludesUntaggedEpisode() {
        Format interview = format(3L, true);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setDefaultFeed(false);
        feed.getFormats().add(interview);

        assertThat(SubscriberFeedFormatMatcher.includes(feed, new Episode())).isFalse();
    }

    private static Format format(Long id, boolean active) {
        Format format = new Format();
        format.setId(id);
        format.setActive(active);
        return format;
    }
}
