package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlatformTenantStatsService {

    private final EpisodeRepository episodeRepository;
    private final SubscriberDirectoryQueryService subscriberDirectoryQueryService;

    public TenantStatsView statsFor(Long tenantId) {
        long episodeCount = episodeRepository.countByTenantId(tenantId);
        long subscriberCount = subscriberDirectoryQueryService.listSubscribers(tenantId).size();
        return new TenantStatsView(episodeCount, subscriberCount);
    }

    public record TenantStatsView(long episodeCount, long subscriberCount) {
    }
}
