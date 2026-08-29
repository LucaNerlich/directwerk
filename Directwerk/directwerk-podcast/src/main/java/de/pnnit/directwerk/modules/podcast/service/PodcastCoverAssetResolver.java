package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PodcastCoverAssetResolver {

    private final MediaAssetRepository mediaAssetRepository;

    public MediaAsset resolveCoverAsset(Long tenantId, Long coverAssetId) {
        if (coverAssetId == null) {
            return null;
        }
        MediaAsset asset = mediaAssetRepository.findById(coverAssetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(coverAssetId));
        if (!tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(coverAssetId);
        }
        if (asset.getStatus() != AssetStatus.READY || asset.getAssetType() != AssetType.IMAGE) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Cover asset must be READY IMAGE"
            );
        }
        return asset;
    }
}
