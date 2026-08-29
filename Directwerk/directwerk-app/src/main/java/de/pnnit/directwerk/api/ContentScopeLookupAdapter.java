package de.pnnit.directwerk.api;

import de.pnnit.directwerk.modules.content.api.ContentScopeLookupApi;
import de.pnnit.directwerk.modules.content.exception.InvalidContentScopeException;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.CategoryRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
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
        try {
            podcastSeriesRepository.findByIdAndTenantId(seriesId, tenantId)
                    .orElseThrow(() -> new SeriesNotFoundException(seriesId));
        } catch (SeriesNotFoundException ex) {
            throw new InvalidContentScopeException(
                    "PODCAST_SERIES",
                    seriesId,
                    "Podcast series " + seriesId + " was not found for this tenant"
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void requireFormat(Long tenantId, Long formatId) {
        try {
            formatRepository.findByIdAndTenantId(formatId, tenantId)
                    .orElseThrow(() -> new FormatNotFoundException(formatId));
        } catch (FormatNotFoundException ex) {
            throw new InvalidContentScopeException(
                    "FORMAT",
                    formatId,
                    "Format " + formatId + " was not found for this tenant"
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void requireCategory(Long tenantId, Long categoryId) {
        try {
            categoryRepository.findByIdAndTenantId(categoryId, tenantId)
                    .orElseThrow(() -> new CategoryNotFoundException(categoryId));
        } catch (CategoryNotFoundException ex) {
            throw new InvalidContentScopeException(
                    "CATEGORY",
                    categoryId,
                    "Category " + categoryId + " was not found for this tenant"
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void requireDigitalAsset(Long tenantId, Long assetId) {
        try {
            mediaAssetRepository.findById(assetId)
                    .filter(asset -> tenantId.equals(asset.getTenant().getId()))
                    .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        } catch (MediaAssetNotFoundException ex) {
            throw new InvalidContentScopeException(
                    "DIGITAL_ASSET",
                    assetId,
                    "Digital asset " + assetId + " was not found for this tenant"
            );
        }
    }
}
