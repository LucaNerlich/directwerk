package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.util.List;
import java.util.Optional;

/**
 * Tenant-scoped media asset lookups.
 */
public interface MediaAssetQueryApi {

    Optional<MediaAsset> findById(Long assetId);

    /**
     * Lists FK-backed content attachments for {@code assetId} (episode audio/cover, series/format
     * cover, article hero, digital publication, denormalized {@code media_assets.episode_id}).
     * Empty when the asset exists but nothing references it. Throws
     * {@link de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException} when the
     * asset is missing or outside the current tenant. Does not include CDN URLs pasted into HTML
     * show notes / article bodies.
     */
    List<MediaAssetReference> listAttachedReferences(Long assetId);

    /**
     * Lists assets filtered by {@code assetType} and {@code status}. When {@code status} is
     * {@code null}, tombstoned rows ({@code ARCHIVED}, {@code PENDING_DELETE}) are excluded —
     * deleted assets are not surfaced to callers unless explicitly requested by status.
     */
    default List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit) {
        return list(assetType, status, limit, 0);
    }

    /** Same as {@link #list(AssetType, AssetStatus, int)} starting at {@code offset}. */
    List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit, int offset);

    /**
     * Lists assets inside one folder. A {@code null} {@code folderId} together with
     * {@code unassignedOnly} lists root-level (unassigned) assets; without either flag
     * this behaves like {@link #list}. When {@code recursive} is true, descendants of
     * {@code folderId} are included. {@code folderId} and {@code unassignedOnly} together
     * are rejected. {@code unreferencedOnly} keeps only assets with no content attachments
     * (same definition as delete-time {@code hasAttachedReferences}).
     */
    default List<MediaAsset> listInFolder(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            int limit) {
        return listInFolder(assetType, status, folderId, recursive, unassignedOnly, false, limit, 0);
    }

    /**
     * Same as the six-argument {@code listInFolder}, starting at {@code offset} rows.
     *
     * <p>Offset paging exists because the endpoint used to expose only {@code limit}, which made
     * every asset past the cap unreachable (#725).
     */
    default List<MediaAsset> listInFolder(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            int limit,
            int offset) {
        return listInFolder(assetType, status, folderId, recursive, unassignedOnly, false, limit, offset);
    }

    /**
     * Full folder/list query including the content-unreferenced filter ({@code unreferencedOnly}).
     * Distinct from {@code unassignedOnly}, which means library-root ({@code folderId} null) only.
     */
    List<MediaAsset> listInFolder(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            boolean unreferencedOnly,
            int limit,
            int offset);

    /**
     * Lists assets for a tenant from a platform (no Host) context by temporarily
     * applying {@code TenantContext} so the Hibernate tenant filter scopes the query.
     */
    List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit);

    /**
     * Resolves the tenant's effective per-asset-type upload limits in bytes
     * (per-tenant overrides where set, platform defaults otherwise).
     */
    EffectiveUploadLimits effectiveUploadLimits(Long tenantId);

    /**
     * Aggregate storage usage for the tenant overview (counts + bytes by type/status).
     */
    MediaStorageSummary storageSummary(Long tenantId);

    record MediaStorageSummary(
            long totalAssets,
            long totalBytes,
            List<MediaStorageBucket> buckets
    ) {
    }

    record MediaStorageBucket(
            AssetType assetType,
            AssetStatus status,
            long assetCount,
            long totalBytes
    ) {
    }

    /**
     * One content attachment of a media asset. {@code kind} values match the delete-in-use sites:
     * {@code EPISODE_AUDIO}, {@code EPISODE_COVER}, {@code SERIES_COVER}, {@code FORMAT_COVER},
     * {@code ARTICLE_HERO}, {@code DIGITAL_PUBLICATION}, {@code MEDIA_EPISODE_LINK}.
     */
    record MediaAssetReference(String kind, Long id, String title) {
    }
}
