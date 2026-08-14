package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.service.TenantLookupService;
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
    private final TenantLookupService tenantLookupService;

    @Override
    public Optional<MediaAsset> findById(Long assetId) {
        if (assetId == null) {
            return Optional.empty();
        }
        return mediaAssetRepository.findById(assetId);
    }

    @Override
    public List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit) {
        int pageSize = Math.min(Math.max(limit, 1), 100);
        return mediaAssetRepository.findFiltered(assetType, status, PageRequest.of(0, pageSize));
    }

    @Override
    public List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit) {
        tenantLookupService.requireTenant(tenantId);
        return TenantContext.callWithTenant(tenantId, () -> list(assetType, status, limit));
    }
}
