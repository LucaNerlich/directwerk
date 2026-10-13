package de.pnnit.directwerk.modules.core.util;

/**
 * The public RSS feed URL grammar. Route templates here and the mappings in
 * {@code RssFeedController} must stay identical — both are pinned by tests, so a drift
 * breaks the build instead of shipping broken links.
 */
public final class FeedUrls {

    /**
     * Issue #389: series slugs whose {@code /feeds/{tenantSlug}/{seriesSlug}.xml} URL would be
     * shadowed by a more specific literal route — {@code /feeds/{tenantSlug}/podcast.xml} and
     * {@code /feeds/{tenantSlug}/articles.xml}. A series with one of these slugs would silently
     * never serve its own feed, so they are reserved at slug-validation time.
     */
    private static final java.util.Set<String> RESERVED_SERIES_SLUGS = java.util.Set.of("podcast", "articles");

    private FeedUrls() {
    }

    /** True when {@code slug} cannot be used for a series because a literal feed route owns it. */
    public static boolean isReservedSeriesSlug(String slug) {
        return slug != null && RESERVED_SERIES_SLUGS.contains(slug);
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

    /** Public tenant-level article feed: {@code /feeds/{tenantSlug}/articles.xml}. */
    public static String tenantArticleFeed(String origin, String tenantSlug) {
        return origin + "/feeds/" + tenantSlug + "/articles.xml";
    }

    /**
     * Token-authenticated article feed: {@code /feeds/{tenantSlug}/articles/u/{feedToken}.xml}.
     * The extra {@code articles/} segment keeps this token space distinct from
     * {@link #subscriberFeed} — article and podcast feed tokens live in independent tables.
     */
    public static String articleSubscriberFeed(String origin, String tenantSlug, String feedToken) {
        return origin + "/feeds/" + tenantSlug + "/articles/u/" + feedToken + ".xml";
    }

    /** Public article view proxy (tracked click-through): {@code /feeds/{tenantSlug}/a/{articleSlug}}. */
    public static String publicArticleView(String origin, String tenantSlug, String articleSlug) {
        return origin + "/feeds/" + tenantSlug + "/a/" + articleSlug;
    }

    /** Private article view proxy: {@code /feeds/{tenantSlug}/articles/u/{feedToken}/a/{articleSlug}}. */
    public static String privateArticleView(
            String origin,
            String tenantSlug,
            String feedToken,
            String articleSlug
    ) {
        return origin + "/feeds/" + tenantSlug + "/articles/u/" + feedToken + "/a/" + articleSlug;
    }
}
