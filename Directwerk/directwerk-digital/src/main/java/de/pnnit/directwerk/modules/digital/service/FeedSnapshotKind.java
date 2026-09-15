package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import java.util.List;
import java.util.function.Function;

/**
 * Content-kind adapter for {@link FeedSnapshotCoordinator}. A kind contributes only the facts the
 * coordinator cannot know: which modules gate its feeds, where each feed lives in object storage,
 * how to enumerate the tenant's feeds, and how to build their XML for a resolved origin.
 *
 * <p>The reconciliation loop, failure isolation, presence bookkeeping, origin resolution and the
 * snapshot key grammar all live in {@link FeedSnapshotCoordinator}. Implementations stay tiny.</p>
 */
public interface FeedSnapshotKind {

    /** Human-readable label used in log lines and the aggregated failure exception. */
    String label();

    /** Module key that gates the tenant's public feeds (e.g. {@code PODCAST_RSS}). */
    String moduleKey();

    /** Module key that gates custom (non-default) private feeds (e.g. {@code FEED_BUILDER}). */
    String feedBuilderModuleKey();

    /** Static object-suffix/kind grammar for this content kind. */
    FeedSnapshotLayout layout();

    /**
     * The tenant-level public feed. {@code xml} is invoked lazily at refresh time so a build
     * failure is isolated to this one feed instead of aborting the whole tenant.
     */
    PublicFeed tenantFeed(Tenant tenant);

    /**
     * Additional public feeds beyond the tenant feed (e.g. one per podcast series). Kinds with a
     * single tenant-level feed return an empty list.
     */
    List<PublicFeed> collectionFeeds(Tenant tenant);

    /** Private subscriber feeds owned by the tenant. */
    List<PrivateFeed> privateFeeds(Tenant tenant);

    /**
     * Resolves the origin used when the tenant has no verified host. The coordinator owns the
     * verified-host branch; this only supplies the per-kind fallback (podcast preserves the studio
     * scheme/port, article always uses {@code https}/443).
     */
    FeedSnapshotOrigin fallbackOrigin(String studioBaseUrl);

    /**
     * Object-suffix and presence-kind grammar for the three feed roles. Suffixes are functions of
     * the numeric subject id so tokens never appear in keys.
     */
    record FeedSnapshotLayout(
            String tenantSuffix,
            String tenantKind,
            Function<Long, String> collectionSuffix,
            String collectionKind,
            Function<Long, String> privateSuffix,
            String privateKind
    ) {
    }

    /** A public feed: subject id plus a lazy XML builder for a resolved origin. */
    record PublicFeed(long subjectId, Function<FeedSnapshotOrigin, String> xml) {
    }

    /** A private subscriber feed, including the policy flags the coordinator needs to decide. */
    record PrivateFeed(
            long subjectId,
            boolean enabled,
            boolean defaultFeed,
            Function<FeedSnapshotOrigin, String> xml
    ) {
    }
}
