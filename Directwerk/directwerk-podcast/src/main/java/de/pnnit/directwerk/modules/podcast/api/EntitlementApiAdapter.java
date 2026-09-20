package de.pnnit.directwerk.modules.podcast.api;

import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
@RequiredArgsConstructor
public class EntitlementApiAdapter implements EntitlementApi {

    /**
     * Canonical published-episode path: {@link EpisodeAccessApi} is the single adapter behind
     * the episode Seam (PUBLISHED guard + evaluation). This adapter only translates the
     * cross-module {@link EntitlementApi} onto it instead of splitting gate/service calls
     * a second time.
     */
    private final EpisodeAccessApi episodeAccessApi;
    private final EntitlementService entitlementService;

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return episodeAccessApi.hasAccess(tenantId, userId, episodeId);
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
    public Set<Long> filterAccessiblePublicationAssets(
            Long tenantId,
            Long userId,
            Map<Long, PublicationAccessPolicy> policiesByAssetId
    ) {
        Map<Long, EntitlementService.DigitalPublicationAccessSubject> subjects = new LinkedHashMap<>();
        policiesByAssetId.forEach((assetId, policy) -> subjects.put(
                assetId,
                new EntitlementService.DigitalPublicationAccessSubject(
                        assetId,
                        policy.free(),
                        policy.requiredLevelSortOrder()
                )));
        return entitlementService.filterAccessiblePublicationAssets(tenantId, userId, subjects);
    }

    @Override
    public List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId) {
        return entitlementService.listEntitledDigitalAssetIds(tenantId, userId);
    }

    @Override
    public boolean hasLevelAtLeast(Long tenantId, Long userId, int minimumSortOrder) {
        return entitlementService.hasLevelAtLeast(tenantId, userId, minimumSortOrder);
    }
}
