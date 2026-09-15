package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotCoordinator;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Article-specific facade over the shared
 * {@link FeedSnapshotCoordinator}. Tenant-level only (articles have no per-series grouping); the
 * reconciliation loop and key grammar live in directwerk-digital.
 */
@Service
public class ArticleRssFeedSnapshotService {

    private final TenantRepository tenantRepository;
    private final ModuleGateService moduleGateService;
    private final FeedSnapshotCoordinator coordinator;

    public ArticleRssFeedSnapshotService(
            ArticleRssFeedService articleRssFeedService,
            TenantRepository tenantRepository,
            TenantPublicHostResolver tenantPublicHostResolver,
            ModuleGateService moduleGateService,
            ArticleFeedRepository articleFeedRepository,
            FeedSnapshotStateStore snapshotStateStore,
            GeneratedFeedSnapshotStore snapshotStore,
            DirectwerkConfig directwerkConfig
    ) {
        this.tenantRepository = tenantRepository;
        this.moduleGateService = moduleGateService;
        this.coordinator = new FeedSnapshotCoordinator(
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                snapshotStateStore,
                snapshotStore,
                directwerkConfig,
                new ArticleSnapshotKind(articleRssFeedService, articleFeedRepository)
        );
    }

    public FeedDelivery publicTenantFeed(Tenant tenant) {
        return coordinator.deliverTenant(tenant);
    }

    /**
     * Presentation lookup for API views: the Host tenant's slug when the public article RSS
     * module is active, else empty.
     */
    public Optional<String> publicRssTenantSlug(Long tenantId) {
        if (!moduleGateService.isModuleActive(tenantId, ArticleRssModule.KEY)) {
            return Optional.empty();
        }
        return tenantRepository.findById(tenantId).map(Tenant::getSlug);
    }

    public FeedDelivery privateFeed(Tenant tenant, ArticleFeed feed) {
        return coordinator.deliverPrivate(tenant, feed.getId());
    }

    public void refreshTenant(Long tenantId) {
        coordinator.refreshTenant(tenantId);
    }

    public void withdrawPrivateFeed(Tenant tenant, Long feedId) {
        coordinator.withdrawPrivateFeed(tenant, feedId);
    }
}
