package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.api.EntitlementApi;
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
}
