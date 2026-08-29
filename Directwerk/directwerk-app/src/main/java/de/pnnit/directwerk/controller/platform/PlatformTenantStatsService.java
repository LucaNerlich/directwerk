package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.modules.podcast.service.EpisodeStatsQueryService;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlatformTenantStatsService {

    private final EpisodeStatsQueryService episodeStatsQueryService;
    private final SubscriberDirectoryQueryService subscriberDirectoryQueryService;

    public TenantStatsView statsFor(Long tenantId) {
        long episodeCount = episodeStatsQueryService.countEpisodes(tenantId);
        long subscriberCount = subscriberDirectoryQueryService.listSubscribers(tenantId).size();
        return new TenantStatsView(episodeCount, subscriberCount);
    }

    public record TenantStatsView(long episodeCount, long subscriberCount) {
    }
}
