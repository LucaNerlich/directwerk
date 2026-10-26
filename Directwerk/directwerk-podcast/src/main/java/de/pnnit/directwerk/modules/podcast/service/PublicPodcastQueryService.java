package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicPodcastQueryService {

    private final SeriesService seriesService;
    private final FormatService formatService;
    private final CategoryService categoryService;
    private final EpisodeRepository episodeRepository;

    @Transactional(readOnly = true)
    public List<PodcastSeries> listPublishedSeries(Long tenantId) {
        return seriesService.listSeries(tenantId, true);
    }

    @Transactional(readOnly = true)
    public List<Episode> listPublishedEpisodes(Long tenantId, Long seriesId) {
        if (seriesId != null) {
            return episodeRepository.findByTenantIdAndSeriesIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                    tenantId,
                    seriesId,
                    EpisodeStatus.PUBLISHED,
                    SeriesStatus.PUBLISHED
            );
        }
        return episodeRepository.findByTenantIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                tenantId,
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        );
    }

    /**
     * Published episode on a published series for the public catalog, or {@link EpisodeNotFoundException}.
     * Slug is unique per tenant (not per series). Returns FREE and PAID alike — audio gating is in the view mapper.
     */
    @Transactional(readOnly = true)
    public Episode requirePublishedEpisode(Long tenantId, String slug) {
        return episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                tenantId,
                slug,
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        ).orElseThrow(() -> new EpisodeNotFoundException(slug));
    }

    @Transactional(readOnly = true)
    public List<Format> listActiveFormats(Long tenantId) {
        return formatService.listFormats(tenantId, true);
    }

    @Transactional(readOnly = true)
    public List<Category> listActiveCategories(Long tenantId) {
        return categoryService.listCategories(tenantId, true);
    }
}
