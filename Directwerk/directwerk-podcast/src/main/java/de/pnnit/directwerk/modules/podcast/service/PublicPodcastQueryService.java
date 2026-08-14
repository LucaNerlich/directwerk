package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
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

    @Transactional(readOnly = true)
    public List<Format> listActiveFormats(Long tenantId) {
        return formatService.listFormats(tenantId, true);
    }

    @Transactional(readOnly = true)
    public List<Category> listActiveCategories(Long tenantId) {
        return categoryService.listCategories(tenantId, true);
    }
}
