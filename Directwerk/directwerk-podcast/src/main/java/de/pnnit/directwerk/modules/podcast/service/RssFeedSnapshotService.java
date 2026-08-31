package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotRef;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Podcast-specific RSS snapshot orchestration: decides which objects exist for a tenant
 * (tenant feed, series feeds, subscriber feeds) and builds their XML. The underlying object
 * storage mechanics (upload/withdraw/deliver, presence tracking) live in the shared
 * {@link GeneratedFeedSnapshotStore}/{@link FeedSnapshotStateStore} (directwerk-digital),
 * reused as-is by the article-feed stack.
 */
@Service
public class RssFeedSnapshotService {

    private static final String RSS_CONTENT_TYPE = "application/rss+xml; charset=UTF-8";

    private final RssFeedService rssFeedService;
    private final TenantRepository tenantRepository;
    private final TenantPublicHostResolver tenantPublicHostResolver;
    private final ModuleGateService moduleGateService;
    private final PodcastSeriesRepository podcastSeriesRepository;
    private final SubscriberFeedRepository subscriberFeedRepository;
    private final FeedSnapshotStateStore snapshotStateStore;
    private final GeneratedFeedSnapshotStore snapshotStore;
    private final DirectwerkConfig directwerkConfig;

    public RssFeedSnapshotService(
            RssFeedService rssFeedService,
            TenantRepository tenantRepository,
            TenantPublicHostResolver tenantPublicHostResolver,
            ModuleGateService moduleGateService,
            PodcastSeriesRepository podcastSeriesRepository,
            SubscriberFeedRepository subscriberFeedRepository,
            FeedSnapshotStateStore snapshotStateStore,
            GeneratedFeedSnapshotStore snapshotStore,
            DirectwerkConfig directwerkConfig
    ) {
        this.rssFeedService = rssFeedService;
        this.tenantRepository = tenantRepository;
        this.tenantPublicHostResolver = tenantPublicHostResolver;
        this.moduleGateService = moduleGateService;
        this.podcastSeriesRepository = podcastSeriesRepository;
        this.subscriberFeedRepository = subscriberFeedRepository;
        this.snapshotStateStore = snapshotStateStore;
        this.snapshotStore = snapshotStore;
        this.directwerkConfig = directwerkConfig;
    }

    public FeedDelivery publicTenantFeed(Tenant tenant) {
        return snapshotStore.deliver(publicTenantRef(tenant));
    }

    public FeedDelivery publicSeriesFeed(
            Tenant tenant,
            PodcastSeries series
    ) {
        return snapshotStore.deliver(publicSeriesRef(tenant, series.getId()));
    }

    /**
     * Presentation lookup for API views: the Host tenant's slug when the public RSS module is
     * active, else empty. Lets controllers build feed URLs without touching repositories or
     * duplicating the module check.
     */
    public Optional<String> publicRssTenantSlug(Long tenantId) {
        if (!rssModuleActive(tenantId)) {
            return Optional.empty();
        }
        return tenantRepository.findById(tenantId).map(Tenant::getSlug);
    }

    /**
     * Slug-based variant so callers do not need series repository access: resolves the
     * published series within the tenant, then delivers its public snapshot.
     */
    public FeedDelivery publicSeriesFeed(Tenant tenant, String seriesSlug) {
        PodcastSeries series = podcastSeriesRepository.findByTenantIdAndSlug(tenant.getId(), seriesSlug)
                .orElseThrow(() -> new SeriesNotFoundException(seriesSlug));
        return snapshotStore.deliver(publicSeriesRef(tenant, series.getId()));
    }

    public FeedDelivery privateFeed(Tenant tenant, SubscriberFeed feed) {
        return snapshotStore.deliver(privateFeedRef(tenant, feed.getId()));
    }

    /**
     * Reconciles S3 snapshots with the tenant's current RSS module and feed state.
     * When {@code PODCAST_RSS} is off, every snapshot is deleted and public/private
     * pull-zone URLs are purged. Disabled subscriber feeds are removed the same way.
     */
    public void refreshTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown tenant id: " + tenantId));
        withdrawStalePrefixes(tenant);
        if (!rssModuleActive(tenantId)) {
            if (!directwerkConfig.isStorageEnabled()) {
                snapshotStateStore.clearWritten(tenantId);
                return;
            }
            withdrawTenant(tenant);
            snapshotStateStore.clearWritten(tenantId);
            return;
        }
        Origin origin = canonicalOrigin(tenantId);

        refresh(publicTenantRef(tenant), () -> rssFeedService.buildPublicFeed(
                tenant, null, origin.scheme(), origin.host(), origin.port()
        ));
        // Rebuild draft/unpublished series too: an old public object must become empty,
        // rather than continue serving episodes from a previous published snapshot.
        podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenantId)
                .forEach(series -> refresh(publicSeriesRef(tenant, series.getId()), () -> rssFeedService.buildPublicFeed(
                        tenant, series, origin.scheme(), origin.host(), origin.port()
                )));
        boolean feedBuilderActive = feedBuilderModuleActive(tenantId);
        subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenantId)
                .forEach(feed -> {
                    boolean customFeedBlocked = !feed.isDefaultFeed() && !feedBuilderActive;
                    if (feed.isEnabled() && !customFeedBlocked) {
                        refresh(privateFeedRef(tenant, feed.getId()), () -> rssFeedService.buildPrivateFeed(
                                tenant, feed, origin.scheme(), origin.host(), origin.port()
                        ));
                    } else {
                        snapshotStore.withdraw(privateFeedRef(tenant, feed.getId()));
                    }
                });
    }

    /**
     * Removes a private feed snapshot immediately (disable/delete). Safe when storage is off:
     * only the presence row is cleared so a later refresh cannot serve a stale object.
     */
    public void withdrawPrivateFeed(Tenant tenant, Long feedId) {
        if (tenant == null || feedId == null) {
            return;
        }
        if (!directwerkConfig.isStorageEnabled()) {
            snapshotStateStore.clearWritten(tenant.getId(), RssSnapshotKind.PRIVATE_FEED.name(), feedId);
            return;
        }
        snapshotStore.withdraw(privateFeedRef(tenant, feedId));
    }

    private void withdrawStalePrefixes(Tenant tenant) {
        for (String staleSlug : snapshotStateStore.stalePrefixes(tenant.getId())) {
            if (!staleSlug.equals(tenant.getSlug())) {
                if (directwerkConfig.isStorageEnabled()) {
                    withdrawTenantAtSlug(tenant, staleSlug);
                }
            }
            snapshotStateStore.clearStalePrefix(tenant.getId(), staleSlug);
        }
    }

    private void withdrawTenant(Tenant tenant) {
        withdrawTenantAtSlug(tenant, tenant.getSlug());
    }

    private void withdrawTenantAtSlug(Tenant tenant, String slug) {
        snapshotStore.withdraw(publicTenantRef(tenant.getId(), slug));
        podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenant.getId())
                .forEach(series -> snapshotStore.withdraw(publicSeriesRef(tenant.getId(), slug, series.getId())));
        subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenant.getId())
                .forEach(feed -> snapshotStore.withdraw(privateFeedRef(tenant.getId(), slug, feed.getId())));
    }

    private void refresh(FeedSnapshotRef ref, XmlSupplier supplier) {
        snapshotStore.upload(ref, supplier.get(), RSS_CONTENT_TYPE);
    }

    private boolean rssModuleActive(Long tenantId) {
        return moduleActive(tenantId, PodcastRssModule.KEY);
    }

    private boolean feedBuilderModuleActive(Long tenantId) {
        return moduleActive(tenantId, FeedBuilderModule.KEY);
    }

    private boolean moduleActive(Long tenantId, String moduleKey) {
        return moduleGateService.isModuleActive(tenantId, moduleKey);
    }

    private Origin canonicalOrigin(Long tenantId) {
        String host = tenantPublicHostResolver.resolve(
                tenantId,
                null,
                TenantPublicHostResolver.HostPolicy.PRIMARY
        );
        return new Origin("https", host, 443);
    }

    private FeedSnapshotRef publicTenantRef(Tenant tenant) {
        return publicTenantRef(tenant.getId(), tenant.getSlug());
    }

    private FeedSnapshotRef publicTenantRef(Long tenantId, String slug) {
        return ref(tenantId, slug, "public/rss/podcast.xml", false, RssSnapshotKind.TENANT, FeedSnapshotStateStore.TENANT_SUBJECT_ID);
    }

    private FeedSnapshotRef publicSeriesRef(Tenant tenant, Long seriesId) {
        return publicSeriesRef(tenant.getId(), tenant.getSlug(), seriesId);
    }

    private FeedSnapshotRef publicSeriesRef(Long tenantId, String slug, Long seriesId) {
        return ref(tenantId, slug, "public/rss/series-" + seriesId + ".xml", false, RssSnapshotKind.SERIES, seriesId);
    }

    private FeedSnapshotRef privateFeedRef(Tenant tenant, Long feedId) {
        return privateFeedRef(tenant.getId(), tenant.getSlug(), feedId);
    }

    private FeedSnapshotRef privateFeedRef(Long tenantId, String slug, Long feedId) {
        return ref(tenantId, slug, "private/rss/feed-" + feedId + ".xml", true, RssSnapshotKind.PRIVATE_FEED, feedId);
    }

    private FeedSnapshotRef ref(
            Long tenantId,
            String tenantSlug,
            String objectSuffix,
            boolean privateFeed,
            RssSnapshotKind kind,
            long subjectId
    ) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("Tenant must have a persistent id");
        }
        return new FeedSnapshotRef(tenantId, tenantSlug, tenantSlug + "/" + objectSuffix, privateFeed, kind.name(), subjectId);
    }

    private record Origin(String scheme, String host, int port) {
    }

    @FunctionalInterface
    private interface XmlSupplier {
        String get();
    }
}
