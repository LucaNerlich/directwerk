package de.pnnit.directwerk.modules.core.util;

/**
 * The public RSS feed URL grammar. Route templates here and the mappings in
 * {@code RssFeedController} must stay identical — both are pinned by tests, so a drift
 * breaks the build instead of shipping broken links.
 */
public final class FeedUrls {

    private FeedUrls() {
    }

    /** Public tenant-level podcast feed: {@code /feeds/{tenantSlug}/podcast.xml}. */
    public static String tenantPodcastFeed(String origin, String tenantSlug) {
        return origin + "/feeds/" + tenantSlug + "/podcast.xml";
    }

    /** Public per-series feed: {@code /feeds/{tenantSlug}/{seriesSlug}.xml}. */
    public static String seriesFeed(String origin, String tenantSlug, String seriesSlug) {
        return origin + "/feeds/" + tenantSlug + "/" + seriesSlug + ".xml";
    }

    /** Token-authenticated subscriber feed: {@code /feeds/{tenantSlug}/u/{feedToken}.xml}. */
    public static String subscriberFeed(String origin, String tenantSlug, String feedToken) {
        return origin + "/feeds/" + tenantSlug + "/u/" + feedToken + ".xml";
    }

    /** Public episode enclosure proxy: {@code /feeds/{tenantSlug}/e/{episodeSlug}.mp3}. */
    public static String publicEnclosure(String origin, String tenantSlug, String episodeSlug) {
        return origin + "/feeds/" + tenantSlug + "/e/" + episodeSlug + ".mp3";
    }

    /** Private episode enclosure proxy: {@code /feeds/{tenantSlug}/u/{feedToken}/e/{episodeSlug}.mp3}. */
    public static String privateEnclosure(
            String origin,
            String tenantSlug,
            String feedToken,
            String episodeSlug
    ) {
        return origin + "/feeds/" + tenantSlug + "/u/" + feedToken + "/e/" + episodeSlug + ".mp3";
    }
}
