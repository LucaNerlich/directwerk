package de.pnnit.directwerk.modules.subscription.api;

import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessApi;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Batch adapter between the podcast module and subscription entitlement evaluation.
 * Builds {@link EntitlementService.EpisodeAccessSubject}s from already-loaded episodes
 * (no per-episode repository round-trips) and evaluates them in one shot.
 */
@Component
@RequiredArgsConstructor
public class EpisodeAccessAdapter implements EpisodeAccessApi {

    private final EntitlementService entitlementService;

    @Override
    public List<Episode> filterAccessible(Long tenantId, Long userId, List<Episode> episodes) {
        Map<Long, EntitlementService.EpisodeAccessSubject> subjects = new LinkedHashMap<>();
        for (Episode episode : episodes) {
            subjects.put(episode.getId(), EpisodeAccessSubjects.toSubject(episode));
        }
        Set<Long> accessibleIds = entitlementService.filterAccessibleEpisodes(tenantId, userId, subjects);
        return episodes.stream()
                .filter(episode -> accessibleIds.contains(episode.getId()))
                .toList();
    }
}
