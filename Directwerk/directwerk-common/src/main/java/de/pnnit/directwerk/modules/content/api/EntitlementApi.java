package de.pnnit.directwerk.modules.content.api;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Entitlement checks before signing private Episode or MediaAsset URLs.
 * Subscription evaluates LEVEL/PACKAGE rules; podcast wires the Episode adapter.
 */
public interface EntitlementApi {

    boolean hasAccess(Long tenantId, Long userId, Long episodeId);

    boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId);

    Set<Long> filterAccessibleDigitalAssets(Long tenantId, Long userId, Collection<Long> mediaAssetIds);

    /**
     * Publication-policy batch gate: evaluates one published publication's access policy per
     * candidate asset — FREE grants every subscriber, LEVEL grants at the required sort order,
     * explicit PACKAGE DIGITAL_ASSET rules still grant. Fail-closed: only granted ids return.
     */
    Set<Long> filterAccessiblePublicationAssets(
            Long tenantId,
            Long userId,
            Map<Long, PublicationAccessPolicy> policiesByAssetId
    );

    /** A published publication's access policy for its backing asset. */
    record PublicationAccessPolicy(boolean free, int requiredLevelSortOrder) {
    }

    /** Distinct PACKAGE-scoped digital asset ids the user may download. */
    List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId);

    /** True when the user holds an active LEVEL product at or above {@code minimumSortOrder}. */
    boolean hasLevelAtLeast(Long tenantId, Long userId, int minimumSortOrder);
}
