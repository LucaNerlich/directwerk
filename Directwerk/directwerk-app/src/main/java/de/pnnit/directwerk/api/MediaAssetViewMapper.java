package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps {@link MediaAsset} entities to API views with CDN URLs resolved via {@link PublicCdnUrlResolver}.
 */
@Component
@RequiredArgsConstructor
public class MediaAssetViewMapper {

    private final PublicCdnUrlResolver publicCdnUrlResolver;

    public MediaAssetView toView(MediaAsset asset) {
        return toView(asset, resolveCdnUrlString(asset));
    }

    public MediaAssetView toView(MediaAsset asset, String cdnUrlOverride) {
        return new MediaAssetView(
                asset.getId(),
                asset.getS3Key(),
                asset.getVisibility().name(),
                asset.getScope().name(),
                asset.getAssetType().name(),
                asset.getStatus().name(),
                asset.getMimeType(),
                asset.getSizeBytes(),
                asset.getBytesTransferred(),
                asset.getOriginalFilename(),
                asset.getEpisodeId(),
                asset.getOwnerUserId(),
                cdnUrlOverride,
                asset.getCreatedAt(),
                asset.getUpdatedAt()
        );
    }

    /**
     * Stable CDN URL for public READY objects only. Private assets stay null.
     */
    public String resolveCdnUrlString(MediaAsset asset) {
        if (asset == null
                || asset.getStatus() != AssetStatus.READY
                || asset.getS3Key() == null
                || asset.getS3Key().isBlank()) {
            return null;
        }
        return publicCdnUrlResolver.resolve(asset).map(URL::toString).orElse(null);
    }
}
