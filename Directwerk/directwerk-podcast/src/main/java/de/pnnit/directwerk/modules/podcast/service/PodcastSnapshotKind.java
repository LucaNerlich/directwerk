package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.FeedSnapshotLayout;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PrivateFeed;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PublicFeed;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotOrigin;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * Podcast facts for {@link de.pnnit.directwerk.modules.digital.service.FeedSnapshotCoordinator}:
 * a tenant-level feed plus one feed per series, and subscriber feeds gated by the feed builder.
 */
@RequiredArgsConstructor
class PodcastSnapshotKind implements FeedSnapshotKind {

    private static final FeedSnapshotLayout LAYOUT = new FeedSnapshotLayout(
            "public/rss/podcast.xml",
            RssSnapshotKind.TENANT.name(),
            id -> "public/rss/series-" + id + ".xml",
            RssSnapshotKind.SERIES.name(),
            id -> "private/rss/feed-" + id + ".xml",
            RssSnapshotKind.PRIVATE_FEED.name()
    );

    private final RssFeedService rssFeedService;
    private final PodcastSeriesRepository podcastSeriesRepository;
    private final SubscriberFeedRepository subscriberFeedRepository;

    @Override
    public String label() {
        return "Podcast RSS";
    }

    @Override
    public String moduleKey() {
        return PodcastRssModule.KEY;
    }

    @Override
    public String feedBuilderModuleKey() {
        return FeedBuilderModule.KEY;
    }

    @Override
    public FeedSnapshotLayout layout() {
        return LAYOUT;
    }

    @Override
    public PublicFeed tenantFeed(Tenant tenant) {
        return new PublicFeed(
                FeedSnapshotStateStore.TENANT_SUBJECT_ID,
                origin -> rssFeedService.buildPublicFeed(tenant, null, origin.scheme(), origin.host(), origin.port())
        );
    }

    @Override
    public List<PublicFeed> collectionFeeds(Tenant tenant) {
        return podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenant.getId()).stream()
                .map(series -> new PublicFeed(
                        series.getId(),
                        origin -> rssFeedService.buildPublicFeed(
                                tenant, series, origin.scheme(), origin.host(), origin.port()
                        )
                ))
                .toList();
    }

    @Override
    public List<PrivateFeed> privateFeeds(Tenant tenant) {
        return subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenant.getId()).stream()
                .map(feed -> new PrivateFeed(
                        feed.getId(),
                        feed.isEnabled(),
                        feed.isDefaultFeed(),
                        origin -> rssFeedService.buildPrivateFeed(
                                tenant, feed, origin.scheme(), origin.host(), origin.port()
                        )
                ))
                .toList();
    }

    @Override
    public FeedSnapshotOrigin fallbackOrigin(String studioBaseUrl) {
        if (studioBaseUrl.isBlank()) {
            return new FeedSnapshotOrigin("https", "localhost", 443);
        }
        try {
            URI uri = URI.create(studioBaseUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || host.isBlank()
                    || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                return new FeedSnapshotOrigin("https", "localhost", 443);
            }
            String normalizedScheme = scheme.equalsIgnoreCase("http") ? "http" : "https";
            int defaultPort = normalizedScheme.equals("http") ? 80 : 443;
            int port = uri.getPort() >= 0 ? uri.getPort() : defaultPort;
            return new FeedSnapshotOrigin(normalizedScheme, host, port);
        } catch (IllegalArgumentException ex) {
            return new FeedSnapshotOrigin("https", "localhost", 443);
        }
    }
}
