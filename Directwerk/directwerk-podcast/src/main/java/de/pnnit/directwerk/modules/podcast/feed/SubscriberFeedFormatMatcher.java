package de.pnnit.directwerk.modules.podcast.feed;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides whether an entitled episode belongs in a private feed.
 * Default feeds are unfiltered. Custom feeds match when the episode is tagged
 * with at least one currently active selected format.
 */
public final class SubscriberFeedFormatMatcher {

    private SubscriberFeedFormatMatcher() {
    }

    public static boolean includes(SubscriberFeed feed, Episode episode) {
        if (feed == null || feed.isDefaultFeed()) {
            return true;
        }
        return episodeMatchesSelectedFormats(episode, selectedActiveFormatIds(feed));
    }

    public static boolean episodeMatchesSelectedFormats(Episode episode, Set<Long> activeFormatIds) {
        if (activeFormatIds == null || activeFormatIds.isEmpty() || episode == null || episode.getFormats() == null) {
            return false;
        }
        return episode.getFormats().stream()
                .map(Format::getId)
                .anyMatch(activeFormatIds::contains);
    }

    public static Set<Long> selectedActiveFormatIds(SubscriberFeed feed) {
        if (feed == null || feed.getFormats() == null) {
            return Set.of();
        }
        return feed.getFormats().stream()
                .filter(Format::isActive)
                .map(Format::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
