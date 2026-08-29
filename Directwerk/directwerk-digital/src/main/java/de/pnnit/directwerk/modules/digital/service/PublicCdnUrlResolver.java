package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.policy.PublicAssetPolicy;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import java.net.URL;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves public CDN URLs for MediaAssets that pass {@link PublicAssetPolicy}.
 */
@Service
@RequiredArgsConstructor
public class PublicCdnUrlResolver {

    private final MediaAssetRepository mediaAssetRepository;
    private final ObjectProvider<S3PublicUrlBuilder> publicUrlBuilderProvider;

    @Transactional(readOnly = true)
    public Optional<URL> resolve(MediaAsset asset) {
        if (asset == null || asset.getId() == null) {
            return Optional.empty();
        }
        MediaAsset managed = mediaAssetRepository.findById(asset.getId()).orElse(null);
        if (managed == null || !PublicAssetPolicy.isPublicCdnEligible(managed.getTenant().getSlug(), managed)) {
            return Optional.empty();
        }
        S3PublicUrlBuilder publicUrlBuilder = publicUrlBuilderProvider.getIfAvailable();
        if (publicUrlBuilder == null) {
            return Optional.empty();
        }
        String normalized = managed.getS3Key().startsWith("/")
                ? managed.getS3Key().substring(1)
                : managed.getS3Key();
        return Optional.of(publicUrlBuilder.cdnUrl(normalized));
    }
}
