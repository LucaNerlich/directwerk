package de.pnnit.directwerk.modules.content.api;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Entitlement checks before signing private Episode or MediaAsset URLs.
 * Subscription evaluates LEVEL/PACKAGE rules; podcast wires the Episode adapter.
 */
public interface EntitlementApi {

    boolean hasAccess(Long tenantId, Long userId, Long episodeId);

    boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId);

    Set<Long> filterAccessibleDigitalAssets(Long tenantId, Long userId, Collection<Long> mediaAssetIds);

    /** Distinct PACKAGE-scoped digital asset ids the user may download. */
    List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId);
}
