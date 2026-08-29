package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EpisodeStatsQueryService {

    private final EpisodeRepository episodeRepository;

    public long countEpisodes(Long tenantId) {
        return episodeRepository.countByTenantId(tenantId);
    }
}
