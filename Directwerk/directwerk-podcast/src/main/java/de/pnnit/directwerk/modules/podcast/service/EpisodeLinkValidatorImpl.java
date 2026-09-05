package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.digital.api.EpisodeLinkValidator;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Validates upload {@code episodeId} links against tenant-scoped episodes so
 * callers cannot attach assets to missing or foreign-tenant episodes.
 */
@Service
@RequiredArgsConstructor
public class EpisodeLinkValidatorImpl implements EpisodeLinkValidator {

    private final EpisodeService episodeService;

    @Override
    public boolean episodeExists(Long tenantId, Long episodeId) {
        if (tenantId == null || episodeId == null) {
            return false;
        }
        try {
            episodeService.requireEpisode(tenantId, episodeId);
            return true;
        } catch (EpisodeNotFoundException ex) {
            return false;
        }
    }
}
