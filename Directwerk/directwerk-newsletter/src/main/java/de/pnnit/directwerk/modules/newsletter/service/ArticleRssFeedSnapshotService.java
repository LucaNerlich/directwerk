package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotRef;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import de.pnnit.directwerk.modules.newsletter.ArticleFeedBuilderModule;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Article-specific RSS snapshot orchestration — mirrors
 * {@code de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService}, but tenant-level
 * only (articles have no per-series grouping). Object storage mechanics are shared with the
 * podcast RSS stack via {@link GeneratedFeedSnapshotStore}/{@link FeedSnapshotStateStore}
 * (directwerk-digital).
 */
@Slf4j
@Service
public class ArticleRssFeedSnapshotService {

    private static final String RSS_CONTENT_TYPE = "application/rss+xml; charset=UTF-8";

    private final ArticleRssFeedService articleRssFeedService;
    private final TenantRepository tenantRepository;
    private final TenantPublicHostResolver tenantPublicHostResolver;
    private final ModuleGateService moduleGateService;
    private final ArticleFeedRepository articleFeedRepository;
    private final FeedSnapshotStateStore snapshotStateStore;
    private final GeneratedFeedSnapshotStore snapshotStore;
    private final DirectwerkConfig directwerkConfig;

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
        this.articleRssFeedService = articleRssFeedService;
        this.tenantRepository = tenantRepository;
        this.tenantPublicHostResolver = tenantPublicHostResolver;
        this.moduleGateService = moduleGateService;
        this.articleFeedRepository = articleFeedRepository;
        this.snapshotStateStore = snapshotStateStore;
        this.snapshotStore = snapshotStore;
        this.directwerkConfig = directwerkConfig;
    }

    public FeedDelivery publicTenantFeed(Tenant tenant) {
        return snapshotStore.deliver(publicTenantRef(tenant));
    }

    /**
     * Presentation lookup for API views: the Host tenant's slug when the public article RSS
     * module is active, else empty.
     */
    public Optional<String> publicRssTenantSlug(Long tenantId) {
        if (!articleRssModuleActive(tenantId)) {
            return Optional.empty();
        }
        return tenantRepository.findById(tenantId).map(Tenant::getSlug);
    }

    public FeedDelivery privateFeed(Tenant tenant, ArticleFeed feed) {
        return snapshotStore.deliver(privateFeedRef(tenant, feed.getId()));
    }

    /**
     * Reconciles S3 snapshots with the tenant's current article RSS module and feed state.
     * When {@code ARTICLE_RSS} is off, every snapshot is deleted. Disabled article feeds are
     * removed the same way.
     *
     * <p>Individual snapshot failures are isolated: every other feed is still refreshed and
     * the previous S3 object stays live; the job then fails so the queue retries the whole
     * tenant (uploads are idempotent).</p>
     */
    public void refreshTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown tenant id: " + tenantId));
        withdrawStalePrefixes(tenant);
        if (!articleRssModuleActive(tenantId)) {
            if (!directwerkConfig.isStorageEnabled()) {
                snapshotStateStore.clearWritten(tenantId);
                return;
            }
            withdrawTenant(tenant);
            snapshotStateStore.clearWritten(tenantId);
            return;
        }
        Origin origin = canonicalOrigin(tenantId);
        List<String> failures = new ArrayList<>();

        refreshQuietly(failures, publicTenantRef(tenant), () -> articleRssFeedService.buildPublicFeed(
                tenant, origin.scheme(), origin.host(), origin.port()
        ));
        boolean feedBuilderActive = articleFeedBuilderModuleActive(tenantId);
        articleFeedRepository.findByTenantIdOrderByIdAsc(tenantId)
                .forEach(feed -> {
                    boolean customFeedBlocked = !feed.isDefaultFeed() && !feedBuilderActive;
                    if (feed.isEnabled() && !customFeedBlocked) {
                        refreshQuietly(failures, privateFeedRef(tenant, feed.getId()), () -> articleRssFeedService.buildPrivateFeed(
                                tenant, feed, origin.scheme(), origin.host(), origin.port()
                        ));
                    } else {
                        withdrawQuietly(failures, privateFeedRef(tenant, feed.getId()));
                    }
                });
        if (!failures.isEmpty()) {
            throw new IllegalStateException(
                    "Article RSS snapshot refresh had failures for tenant " + tenantId + ": "
                            + String.join("; ", failures)
            );
        }
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
            snapshotStateStore.clearWritten(tenant.getId(), ArticleFeedSnapshotKind.ARTICLE_PRIVATE_FEED.name(), feedId);
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

    private void refreshQuietly(List<String> failures, FeedSnapshotRef ref, Supplier<String> xmlSupplier) {
        try {
            snapshotStore.upload(ref, xmlSupplier.get(), RSS_CONTENT_TYPE);
        } catch (RuntimeException ex) {
            log.warn("Article RSS snapshot refresh failed for {}: {}", ref.objectKey(), ex.getMessage());
            failures.add(ref.objectKey() + ": " + ex.getMessage());
        }
    }

    private void withdrawQuietly(List<String> failures, FeedSnapshotRef ref) {
        try {
            snapshotStore.withdraw(ref);
        } catch (RuntimeException ex) {
            log.warn("Article RSS snapshot withdraw failed for {}: {}", ref.objectKey(), ex.getMessage());
            failures.add(ref.objectKey() + ": " + ex.getMessage());
        }
    }

    private void withdrawTenantAtSlug(Tenant tenant, String slug) {
        snapshotStore.withdraw(publicTenantRef(tenant.getId(), slug));
        articleFeedRepository.findByTenantIdOrderByIdAsc(tenant.getId())
                .forEach(feed -> snapshotStore.withdraw(privateFeedRef(tenant.getId(), slug, feed.getId())));
    }

    private boolean articleRssModuleActive(Long tenantId) {
        return moduleGateService.isModuleActive(tenantId, ArticleRssModule.KEY);
    }

    private boolean articleFeedBuilderModuleActive(Long tenantId) {
        return moduleGateService.isModuleActive(tenantId, ArticleFeedBuilderModule.KEY);
    }

    private Origin canonicalOrigin(Long tenantId) {
        String host = tenantPublicHostResolver.findPrimaryVerifiedHost(tenantId)
                .orElseGet(this::fallbackHost);
        return new Origin("https", host, 443);
    }

    /**
     * Feeds for tenants without a verified domain still need absolute enclosure URLs. Fall back
     * to the studio base URL host (same policy as {@code PublicContentUrlResolver}) instead of
     * failing the whole refresh job.
     */
    private String fallbackHost() {
        String studioBase = directwerkConfig.email() != null && directwerkConfig.email().studioBaseUrl() != null
                ? directwerkConfig.email().studioBaseUrl().trim()
                : "";
        if (studioBase.isBlank()) {
            return "localhost";
        }
        try {
            String host = URI.create(studioBase).getHost();
            return host == null || host.isBlank() ? "localhost" : host;
        } catch (IllegalArgumentException ex) {
            return "localhost";
        }
    }

    private FeedSnapshotRef publicTenantRef(Tenant tenant) {
        return publicTenantRef(tenant.getId(), tenant.getSlug());
    }

    private FeedSnapshotRef publicTenantRef(Long tenantId, String slug) {
        return ref(tenantId, slug, "public/rss/articles.xml", false, ArticleFeedSnapshotKind.ARTICLE_TENANT, FeedSnapshotStateStore.TENANT_SUBJECT_ID);
    }

    private FeedSnapshotRef privateFeedRef(Tenant tenant, Long feedId) {
        return privateFeedRef(tenant.getId(), tenant.getSlug(), feedId);
    }

    private FeedSnapshotRef privateFeedRef(Long tenantId, String slug, Long feedId) {
        return ref(tenantId, slug, "private/rss/article-feed-" + feedId + ".xml", true, ArticleFeedSnapshotKind.ARTICLE_PRIVATE_FEED, feedId);
    }

    private FeedSnapshotRef ref(
            Long tenantId,
            String tenantSlug,
            String objectSuffix,
            boolean privateFeed,
            ArticleFeedSnapshotKind kind,
            long subjectId
    ) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("Tenant must have a persistent id");
        }
        return new FeedSnapshotRef(tenantId, tenantSlug, tenantSlug + "/" + objectSuffix, privateFeed, kind.name(), subjectId);
    }

    private record Origin(String scheme, String host, int port) {
    }
}
