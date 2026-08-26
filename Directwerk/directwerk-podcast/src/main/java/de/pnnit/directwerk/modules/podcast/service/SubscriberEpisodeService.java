package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessApi;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriberEpisodeService {

    private final EpisodeRepository episodeRepository;
    private final EpisodeAccessApi episodeAccessApi;

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
    public List<Episode> listPublishedEpisodes(Long tenantId) {
        return episodeRepository.findByTenantIdAndStatusAndSeriesStatusOrderByPublishedAtDescIdDesc(
                tenantId,
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        );
    }

    /**
     * One batched entitlement evaluation for the whole list — no per-episode subscription lookups.
     */
    @Transactional(readOnly = true)
    public List<Episode> listEntitledEpisodes(Long tenantId, Long userId) {
        return episodeAccessApi.filterAccessible(tenantId, userId, listPublishedEpisodes(tenantId));
    }
}
