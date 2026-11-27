package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.core.util.OffsetLimitPageRequest;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
     * One page of the public catalog (#1036 review): ids are paged in SQL, then the mapped graph
     * is loaded for those ids only. The unpaged sibling stays for RSS, which needs the whole feed.
     */
    @Transactional(readOnly = true)
    public List<Episode> listPublishedEpisodes(Long tenantId, Long seriesId, int limit, int offset) {
        OffsetLimitPageRequest page = OffsetLimitPageRequest.of(limit, offset);
        List<Long> ids = seriesId != null
                ? episodeRepository.findPublishedIdsForSeries(
                        tenantId,
                        seriesId,
                        EpisodeStatus.PUBLISHED,
                        SeriesStatus.PUBLISHED,
                        page
                )
                : episodeRepository.findPublishedIds(
                        tenantId,
                        EpisodeStatus.PUBLISHED,
                        SeriesStatus.PUBLISHED,
                        page
                );
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Episode> byId = new HashMap<>();
        for (Episode episode : episodeRepository.findPublicByIds(tenantId, ids)) {
            byId.put(episode.getId(), episode);
        }
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
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
