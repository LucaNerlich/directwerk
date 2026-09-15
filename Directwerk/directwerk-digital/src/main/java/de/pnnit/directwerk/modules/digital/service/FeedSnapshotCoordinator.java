package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PrivateFeed;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PublicFeed;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotRef;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Shared reconciliation orchestration for generated feed snapshots. Given a
 * {@link FeedSnapshotKind} adapter it decides which objects should exist for a tenant, keeps the
 * S3 objects and presence rows in sync, purges stale tenant prefixes, and isolates per-feed
 * failures so one bad feed cannot strand the rest of the tenant.
 *
 * <p>The object-storage mechanics (upload/withdraw/deliver, presence tracking) live in
 * {@link GeneratedFeedSnapshotStore}/{@link FeedSnapshotStateStore}. This class owns only the
 * orchestration and the snapshot key grammar, so podcast and article feed stacks share one loop.</p>
 */
@Slf4j
@RequiredArgsConstructor
public class FeedSnapshotCoordinator {

    private static final String RSS_CONTENT_TYPE = "application/rss+xml; charset=UTF-8";

    private final TenantRepository tenantRepository;
    private final TenantPublicHostResolver tenantPublicHostResolver;
    private final ModuleGateService moduleGateService;
    private final FeedSnapshotStateStore snapshotStateStore;
    private final GeneratedFeedSnapshotStore snapshotStore;
    private final DirectwerkConfig directwerkConfig;
    private final FeedSnapshotKind kind;

    public FeedDelivery deliverTenant(Tenant tenant) {
        return snapshotStore.deliver(tenantRef(tenant.getId(), tenant.getSlug()));
    }

    public FeedDelivery deliverCollection(Tenant tenant, long subjectId) {
        return snapshotStore.deliver(collectionRef(tenant.getId(), tenant.getSlug(), subjectId));
    }

    public FeedDelivery deliverPrivate(Tenant tenant, long subjectId) {
        return snapshotStore.deliver(privateRef(tenant.getId(), tenant.getSlug(), subjectId));
    }

    /**
     * Reconciles S3 snapshots with the tenant's current module and feed state. When the content
     * module is off, every snapshot is deleted and public/private pull-zone URLs are purged.
     * Disabled or blocked subscriber feeds are removed the same way.
     *
     * <p>Individual snapshot failures are isolated: every other feed is still refreshed and the
     * previous S3 object stays live; this method then fails so the queue retries the whole tenant
     * (uploads are idempotent).</p>
     */
    public void refreshTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown tenant id: " + tenantId));
        withdrawStalePrefixes(tenant);
        if (!moduleGateService.isModuleActive(tenantId, kind.moduleKey())) {
            if (!directwerkConfig.isStorageEnabled()) {
                snapshotStateStore.clearWritten(tenantId);
                return;
            }
            withdrawTenant(tenant);
            snapshotStateStore.clearWritten(tenantId);
            return;
        }
        FeedSnapshotOrigin origin = canonicalOrigin(tenantId);
        List<String> failures = new ArrayList<>();

        PublicFeed tenantFeed = kind.tenantFeed(tenant);
        refreshQuietly(
                failures,
                tenantRef(tenant.getId(), tenant.getSlug()),
                () -> tenantFeed.xml().apply(origin)
        );
        // Rebuild draft/unpublished collections too: an old public object must become empty,
        // rather than continue serving content from a previous published snapshot.
        kind.collectionFeeds(tenant).forEach(feed -> refreshQuietly(
                failures,
                collectionRef(tenant.getId(), tenant.getSlug(), feed.subjectId()),
                () -> feed.xml().apply(origin)
        ));
        boolean feedBuilderActive = moduleGateService.isModuleActive(tenantId, kind.feedBuilderModuleKey());
        kind.privateFeeds(tenant).forEach(feed -> {
            boolean customFeedBlocked = !feed.defaultFeed() && !feedBuilderActive;
            if (feed.enabled() && !customFeedBlocked) {
                refreshQuietly(
                        failures,
                        privateRef(tenant.getId(), tenant.getSlug(), feed.subjectId()),
                        () -> feed.xml().apply(origin)
                );
            } else {
                withdrawQuietly(failures, privateRef(tenant.getId(), tenant.getSlug(), feed.subjectId()));
            }
        });
        if (!failures.isEmpty()) {
            throw new IllegalStateException(
                    kind.label() + " snapshot refresh had failures for tenant " + tenantId + ": "
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
            snapshotStateStore.clearWritten(tenant.getId(), kind.layout().privateKind(), feedId);
            return;
        }
        snapshotStore.withdraw(privateRef(tenant.getId(), tenant.getSlug(), feedId));
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
        snapshotStore.withdraw(tenantRef(tenant.getId(), slug));
        kind.collectionFeeds(tenant)
                .forEach(feed -> snapshotStore.withdraw(collectionRef(tenant.getId(), slug, feed.subjectId())));
        kind.privateFeeds(tenant)
                .forEach(feed -> snapshotStore.withdraw(privateRef(tenant.getId(), slug, feed.subjectId())));
    }

    private void refreshQuietly(List<String> failures, FeedSnapshotRef ref, Supplier<String> xmlSupplier) {
        try {
            snapshotStore.upload(ref, xmlSupplier.get(), RSS_CONTENT_TYPE);
        } catch (RuntimeException ex) {
            log.warn("{} snapshot refresh failed for {}: {}", kind.label(), ref.objectKey(), ex.getMessage());
            failures.add(ref.objectKey() + ": " + ex.getMessage());
        }
    }

    private void withdrawQuietly(List<String> failures, FeedSnapshotRef ref) {
        try {
            snapshotStore.withdraw(ref);
        } catch (RuntimeException ex) {
            log.warn("{} snapshot withdraw failed for {}: {}", kind.label(), ref.objectKey(), ex.getMessage());
            failures.add(ref.objectKey() + ": " + ex.getMessage());
        }
    }

    private FeedSnapshotOrigin canonicalOrigin(Long tenantId) {
        return tenantPublicHostResolver.findPrimaryVerifiedHost(tenantId)
                .map(host -> new FeedSnapshotOrigin("https", host, 443))
                .orElseGet(() -> kind.fallbackOrigin(studioBaseUrl()));
    }

    private String studioBaseUrl() {
        return directwerkConfig.email() != null && directwerkConfig.email().studioBaseUrl() != null
                ? directwerkConfig.email().studioBaseUrl().trim()
                : "";
    }

    private FeedSnapshotRef tenantRef(Long tenantId, String slug) {
        return ref(
                tenantId,
                slug,
                kind.layout().tenantSuffix(),
                false,
                kind.layout().tenantKind(),
                FeedSnapshotStateStore.TENANT_SUBJECT_ID
        );
    }

    private FeedSnapshotRef collectionRef(Long tenantId, String slug, long subjectId) {
        return ref(
                tenantId,
                slug,
                kind.layout().collectionSuffix().apply(subjectId),
                false,
                kind.layout().collectionKind(),
                subjectId
        );
    }

    private FeedSnapshotRef privateRef(Long tenantId, String slug, long subjectId) {
        return ref(
                tenantId,
                slug,
                kind.layout().privateSuffix().apply(subjectId),
                true,
                kind.layout().privateKind(),
                subjectId
        );
    }

    private FeedSnapshotRef ref(
            Long tenantId,
            String tenantSlug,
            String objectSuffix,
            boolean privateFeed,
            String kind,
            long subjectId
    ) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("Tenant must have a persistent id");
        }
        return new FeedSnapshotRef(tenantId, tenantSlug, tenantSlug + "/" + objectSuffix, privateFeed, kind, subjectId);
    }
}
