package de.pnnit.directwerk.api;

import de.pnnit.directwerk.modules.content.api.ContentScopeLookupApi;
import de.pnnit.directwerk.modules.content.exception.InvalidContentScopeException;
import de.pnnit.directwerk.modules.digital.repository.CategoryRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ContentScopeLookupAdapter implements ContentScopeLookupApi {

    private final PodcastSeriesRepository podcastSeriesRepository;
    private final FormatRepository formatRepository;
    private final CategoryRepository categoryRepository;
    private final MediaAssetRepository mediaAssetRepository;

    @Override
    @Transactional(readOnly = true)
    public void requirePodcastSeries(Long tenantId, Long seriesId) {
        podcastSeriesRepository.findByIdAndTenantId(seriesId, tenantId)
                .orElseThrow(() -> new InvalidContentScopeException(
                        "PODCAST_SERIES",
                        seriesId,
                        "Podcast series " + seriesId + " was not found for this tenant"
                ));
    }

    @Override
    @Transactional(readOnly = true)
    public void requireFormat(Long tenantId, Long formatId) {
        formatRepository.findByIdAndTenantId(formatId, tenantId)
                .orElseThrow(() -> new InvalidContentScopeException(
                        "FORMAT",
                        formatId,
                        "Format " + formatId + " was not found for this tenant"
                ));
    }

    @Override
    @Transactional(readOnly = true)
    public void requireCategory(Long tenantId, Long categoryId) {
        categoryRepository.findByIdAndTenantId(categoryId, tenantId)
                .orElseThrow(() -> new InvalidContentScopeException(
                        "CATEGORY",
                        categoryId,
                        "Category " + categoryId + " was not found for this tenant"
                ));
    }

    @Override
    @Transactional(readOnly = true)
    public void requireDigitalAsset(Long tenantId, Long assetId) {
        mediaAssetRepository.findById(assetId)
                .filter(asset -> tenantId.equals(asset.getTenant().getId()))
                .orElseThrow(() -> new InvalidContentScopeException(
                        "DIGITAL_ASSET",
                        assetId,
                        "Digital asset " + assetId + " was not found for this tenant"
                ));
    }
}
