package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessSubjects;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Canonical published-episode entitlement check shared by {@code EntitlementApi} and
 * {@code EpisodeAccessApi} adapters.
 */
@Component
@RequiredArgsConstructor
public class PublishedEpisodeEntitlementGate {

    private final EpisodeRepository episodeRepository;
    private final EntitlementService entitlementService;

    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return episodeRepository.findByIdAndTenantId(episodeId, tenantId)
                .filter(episode -> episode.getStatus() == EpisodeStatus.PUBLISHED)
                .map(episode -> entitlementService.hasEpisodeAccess(
                        tenantId, userId, EpisodeAccessSubjects.toSubject(episode)))
                .orElse(false);
    }
}
