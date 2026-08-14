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

    List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit);

    /**
     * Lists assets for a tenant from a platform (no Host) context by temporarily
     * applying {@code TenantContext} so the Hibernate tenant filter scopes the query.
     */
    List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit);
}
