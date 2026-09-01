package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SeriesService {

    private static final int MAX_LANGUAGE_LENGTH = 8;
    private static final int MAX_ITUNES_CATEGORY_LENGTH = 128;

    private final PodcastSeriesRepository podcastSeriesRepository;
    private final TenantRepository tenantRepository;
    private final PodcastCoverAssetResolver podcastCoverAssetResolver;
    private final RssFeedRefreshScheduler rssFeedRefreshScheduler;

    @Transactional(readOnly = true)
    public List<PodcastSeries> listSeries(Long tenantId, boolean publishedOnly) {
        if (publishedOnly) {
            return podcastSeriesRepository.findByTenantIdAndStatusOrderByTitleAscIdAsc(
                    tenantId,
                    SeriesStatus.PUBLISHED
            );
        }
        return podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public PodcastSeries requireSeries(Long tenantId, Long seriesId) {
        return podcastSeriesRepository.findByIdAndTenantId(seriesId, tenantId)
                .orElseThrow(() -> new SeriesNotFoundException(seriesId));
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public PodcastSeries createSeries(
            Long tenantId,
            String rawSlug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory,
            Integer defaultRequiredLevelSortOrder
    ) {
        String slug = SlugNormalizer.normalize(rawSlug);
        if (podcastSeriesRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.SERIES_SLUG_EXISTS, "Series slug already exists: " + slug);
        }

        PodcastSeries series = new PodcastSeries();
        series.setTenant(tenantRepository.getReferenceById(tenantId));
        series.setSlug(slug);
        series.setTitle(TitleNormalizer.normalize(title, "Series"));
        series.setDescription(normalizeText(description));
        series.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        series.setLanguage(normalizeLanguage(language));
        series.setItunesCategory(normalizeItunesCategory(itunesCategory));
        series.setDefaultRequiredLevelSortOrder(FieldConstraints.requireNonNegative(
                defaultRequiredLevelSortOrder,
                "defaultRequiredLevelSortOrder"
        ));
        series.setStatus(SeriesStatus.DRAFT);
        PodcastSeries saved = podcastSeriesRepository.save(series);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public PodcastSeries updateSeries(
            Long tenantId,
            Long seriesId,
            String rawSlug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory,
            Integer defaultRequiredLevelSortOrder,
            SeriesStatus status
    ) {
        PodcastSeries series = requireSeries(tenantId, seriesId);
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (podcastSeriesRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, seriesId)) {
                throw new ConflictException(ConflictCodes.SERIES_SLUG_EXISTS, "Series slug already exists: " + slug);
            }
            series.setSlug(slug);
        }
        if (title != null) {
            series.setTitle(TitleNormalizer.normalize(title, "Series"));
        }
        if (description != null) {
            series.setDescription(normalizeText(description));
        }
        if (coverAssetId != null) {
            series.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        }
        if (language != null) {
            series.setLanguage(normalizeLanguage(language));
        }
        if (itunesCategory != null) {
            series.setItunesCategory(normalizeItunesCategory(itunesCategory));
        }
        if (defaultRequiredLevelSortOrder != null) {
            series.setDefaultRequiredLevelSortOrder(FieldConstraints.requireNonNegative(
                    defaultRequiredLevelSortOrder,
                    "defaultRequiredLevelSortOrder"
            ));
        }
        if (status != null) {
            series.setStatus(status);
        }
        PodcastSeries saved = podcastSeriesRepository.save(series);
        rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        return saved;
    }

    private static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) {
            return "de";
        }
        String normalized = language.trim();
        if (normalized.length() > MAX_LANGUAGE_LENGTH) {
            throw new IllegalArgumentException("Language must be at most 8 characters");
        }
        return normalized;
    }

    private static String normalizeItunesCategory(String itunesCategory) {
        if (itunesCategory == null || itunesCategory.isBlank()) {
            return null;
        }
        String normalized = itunesCategory.trim();
        if (normalized.length() > MAX_ITUNES_CATEGORY_LENGTH) {
            throw new IllegalArgumentException("iTunes category must be at most 128 characters");
        }
        return normalized;
    }

    private static String normalizeText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
