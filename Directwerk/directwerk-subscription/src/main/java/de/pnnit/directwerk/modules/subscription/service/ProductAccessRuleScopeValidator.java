package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.exception.CategoryNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.CategoryRepository;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductAccessRuleScopeValidator {

    private final PodcastSeriesRepository podcastSeriesRepository;
    private final FormatRepository formatRepository;
    private final CategoryRepository categoryRepository;
    private final MediaAssetRepository mediaAssetRepository;

    /**
     * Transactional (read-only) so repository lookups run on a transaction-bound
     * session and the tenant Hibernate filter applies.
     */
    @Transactional(readOnly = true)
    public void validateScope(Long tenantId, ProductAccessScopeType scopeType, Long scopeId) {
        if (scopeType == null) {
            return;
        }
        switch (scopeType) {
            case PODCAST_SERIES -> {
                if (scopeId != null) {
                    podcastSeriesRepository.findByIdAndTenantId(scopeId, tenantId)
                            .orElseThrow(() -> new SeriesNotFoundException(scopeId));
                }
            }
            case FORMAT -> {
                if (scopeId != null) {
                    formatRepository.findByIdAndTenantId(scopeId, tenantId)
                            .orElseThrow(() -> new FormatNotFoundException(scopeId));
                }
            }
            case CATEGORY -> {
                if (scopeId != null) {
                    categoryRepository.findByIdAndTenantId(scopeId, tenantId)
                            .orElseThrow(() -> new CategoryNotFoundException(scopeId));
                }
            }
            case DIGITAL_ASSET -> {
                if (scopeId != null) {
                    mediaAssetRepository.findById(scopeId)
                            .filter(asset -> tenantId.equals(asset.getTenant().getId()))
                            .orElseThrow(() -> new MediaAssetNotFoundException(scopeId));
                }
            }
            case ALL_PODCASTS, FEED_BUILDER -> {
            }
            default -> throw new IllegalStateException("Unexpected scope type: " + scopeType);
        }
    }
}
