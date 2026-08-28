package de.pnnit.directwerk.modules.podcast.api;

import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
@RequiredArgsConstructor
public class EntitlementApiAdapter implements EntitlementApi {

    private final EpisodeRepository episodeRepository;
    private final EntitlementService entitlementService;

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return episodeRepository.findByIdAndTenantId(episodeId, tenantId)
                .filter(episode -> episode.getStatus() == EpisodeStatus.PUBLISHED)
                .map(episode -> entitlementService.hasEpisodeAccess(tenantId, userId, EpisodeAccessSubjects.toSubject(episode)))
                .orElse(false);
    }

    @Override
    public boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId) {
        return entitlementService.hasDigitalAssetAccess(tenantId, userId, mediaAssetId);
    }

    @Override
    public Set<Long> filterAccessibleDigitalAssets(Long tenantId, Long userId, Collection<Long> mediaAssetIds) {
        return entitlementService.filterAccessibleDigitalAssetIds(tenantId, userId, mediaAssetIds);
    }

    @Override
    public List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId) {
        return entitlementService.listEntitledDigitalAssetIds(tenantId, userId);
    }
}
