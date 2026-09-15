package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotCoordinator;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Podcast-specific facade over the shared
 * {@link FeedSnapshotCoordinator}. Supplies only the podcast enumeration (tenant feed, series
 * feeds, subscriber feeds); the reconciliation loop and key grammar live in directwerk-digital.
 */
@Service
public class RssFeedSnapshotService {

    private final TenantRepository tenantRepository;
    private final ModuleGateService moduleGateService;
    private final PodcastSeriesRepository podcastSeriesRepository;
    private final FeedSnapshotCoordinator coordinator;

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
        this.tenantRepository = tenantRepository;
        this.moduleGateService = moduleGateService;
        this.podcastSeriesRepository = podcastSeriesRepository;
        this.coordinator = new FeedSnapshotCoordinator(
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                snapshotStateStore,
                snapshotStore,
                directwerkConfig,
                new PodcastSnapshotKind(rssFeedService, podcastSeriesRepository, subscriberFeedRepository)
        );
    }

    public FeedDelivery publicTenantFeed(Tenant tenant) {
        return coordinator.deliverTenant(tenant);
    }

    public FeedDelivery publicSeriesFeed(
            Tenant tenant,
            PodcastSeries series
    ) {
        return coordinator.deliverCollection(tenant, series.getId());
    }

    /**
     * Presentation lookup for API views: the Host tenant's slug when the public RSS module is
     * active, else empty. Lets controllers build feed URLs without touching repositories or
     * duplicating the module check.
     */
    public Optional<String> publicRssTenantSlug(Long tenantId) {
        if (!moduleGateService.isModuleActive(tenantId, PodcastRssModule.KEY)) {
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
        return coordinator.deliverCollection(tenant, series.getId());
    }

    public FeedDelivery privateFeed(Tenant tenant, SubscriberFeed feed) {
        return coordinator.deliverPrivate(tenant, feed.getId());
    }

    public void refreshTenant(Long tenantId) {
        coordinator.refreshTenant(tenantId);
    }

    public void withdrawPrivateFeed(Tenant tenant, Long feedId) {
        coordinator.withdrawPrivateFeed(tenant, feedId);
    }
}
