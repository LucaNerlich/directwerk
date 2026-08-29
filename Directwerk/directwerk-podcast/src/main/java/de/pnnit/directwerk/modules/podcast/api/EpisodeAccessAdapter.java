package de.pnnit.directwerk.modules.podcast.api;

import de.pnnit.directwerk.modules.podcast.access.PublishedEpisodeEntitlementGate;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EpisodeAccessAdapter implements EpisodeAccessApi {

    private final EntitlementService entitlementService;
    private final EpisodeRepository episodeRepository;
    private final PublishedEpisodeEntitlementGate publishedEpisodeEntitlementGate;

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

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return publishedEpisodeEntitlementGate.hasAccess(tenantId, userId, episodeId);
    }
}
