package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.content.api.ContentScopeLookupApi;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductAccessRuleScopeValidator {

    private final ContentScopeLookupApi contentScopeLookupApi;

    @Transactional(readOnly = true)
    public void validateScope(Long tenantId, ProductAccessScopeType scopeType, Long scopeId) {
        if (scopeType == null) {
            return;
        }
        if (scopeType == ProductAccessScopeType.FEED_BUILDER) {
            throw new IllegalArgumentException(
                    "FEED_BUILDER product access rules are not supported; custom feeds are module-gated"
            );
        }
        if (scopeId == null) {
            return;
        }
        switch (scopeType) {
            case PODCAST_SERIES -> contentScopeLookupApi.requirePodcastSeries(tenantId, scopeId);
            case FORMAT -> contentScopeLookupApi.requireFormat(tenantId, scopeId);
            case CATEGORY -> contentScopeLookupApi.requireCategory(tenantId, scopeId);
            case DIGITAL_ASSET -> contentScopeLookupApi.requireDigitalAsset(tenantId, scopeId);
            case ALL_PODCASTS -> {
            }
            default -> throw new IllegalStateException("Unexpected scope type: " + scopeType);
        }
    }
}
