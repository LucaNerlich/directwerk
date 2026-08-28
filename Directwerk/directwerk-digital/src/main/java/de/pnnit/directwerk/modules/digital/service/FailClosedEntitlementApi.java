package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

/**
 * Conditional fail-closed entitlement fallback used when the app does not wire a real adapter.
 */
@Service
@ConditionalOnMissingBean(EntitlementApi.class)
public class FailClosedEntitlementApi implements EntitlementApi {

    @Override
    public boolean hasAccess(Long tenantId, Long userId, Long episodeId) {
        return false;
    }

    @Override
    public boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId) {
        return false;
    }

    @Override
    public Set<Long> filterAccessibleDigitalAssets(Long tenantId, Long userId, Collection<Long> mediaAssetIds) {
        return Set.of();
    }

    @Override
    public List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId) {
        return List.of();
    }
}
