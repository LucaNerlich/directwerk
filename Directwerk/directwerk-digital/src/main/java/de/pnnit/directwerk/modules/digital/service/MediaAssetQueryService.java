package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MediaAssetQueryService implements MediaAssetQueryApi {

    private final MediaAssetRepository mediaAssetRepository;
    private final TenantRepository tenantRepository;

    @Override
    public Optional<MediaAsset> findById(Long assetId) {
        if (assetId == null) {
            return Optional.empty();
        }
        Optional<MediaAsset> asset = mediaAssetRepository.findById(assetId);
        // Hibernate filters do not apply to EntityManager.find() — the path behind
        // repository findById — so enforce the Host-derived TenantContext explicitly.
        // Without this, any editor could read another tenant's asset metadata
        // (including s3Key, ownerUserId, episode linkage) by ID via
        // GET /api/v1/media/{id} or GET /api/v1/podcast/import/assets/{assetId}.
        // A mismatch returns empty so callers map to 404, never a cross-tenant leak.
        // Absent context (platform ops / workers scope explicitly via callWithTenant)
        // preserves existing behavior.
        Long contextTenantId = TenantContext.getTenantId();
        if (contextTenantId == null) {
            return asset;
        }
        return asset.filter(candidate ->
                candidate.getTenant() != null && contextTenantId.equals(candidate.getTenant().getId()));
    }

    @Override
    public List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit) {
        int pageSize = Math.min(Math.max(limit, 1), 100);
        return mediaAssetRepository.findFiltered(assetType, status, PageRequest.of(0, pageSize));
    }

    @Override
    public List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit) {
        tenantRepository.requireById(tenantId);
        return TenantContext.callWithTenant(tenantId, () -> list(assetType, status, limit));
    }
}
