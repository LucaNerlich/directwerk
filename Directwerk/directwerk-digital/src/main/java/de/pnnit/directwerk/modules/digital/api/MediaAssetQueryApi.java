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
     * Lists assets filtered by {@code assetType} and {@code status}. When {@code status} is
     * {@code null}, tombstoned rows ({@code ARCHIVED}, {@code PENDING_DELETE}) are excluded —
     * deleted assets are not surfaced to callers unless explicitly requested by status.
     */
    List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit);

    /**
     * Lists assets inside one folder. A {@code null} {@code folderId} together with
     * {@code unassignedOnly} lists root-level (unassigned) assets; without either flag
     * this behaves like {@link #list}. When {@code recursive} is true, descendants of
     * {@code folderId} are included. {@code folderId} and {@code unassignedOnly} together
     * are rejected.
     */
    List<MediaAsset> listInFolder(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            int limit);

    /**
     * Lists assets for a tenant from a platform (no Host) context by temporarily
     * applying {@code TenantContext} so the Hibernate tenant filter scopes the query.
     */
    List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit);
}
