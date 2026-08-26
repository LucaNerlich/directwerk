package de.pnnit.directwerk.modules.digital.api;

import java.util.Collection;
import java.util.Set;

/**
 * Storage-layer entitlement checks used before signing private asset URLs.
 * The app wires LEVEL/PACKAGE evaluation through its subscription adapter. Digital's conditional
 * fallback remains fail-closed when no adapter is available.
 */
public interface EntitlementApi {

    /**
     * Whether the user may access the episode-linked private asset.
     */
    boolean hasAccess(Long tenantId, Long userId, Long episodeId);

    /**
     * Whether the user may access a standalone digital file (no episode link).
     */
    boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId);

    /**
     * Batch form of {@link #hasDigitalAssetAccess}: one evaluation for many candidate assets.
     * Fail-closed — only explicitly granted ids are returned.
     */
    Set<Long> filterAccessibleDigitalAssets(Long tenantId, Long userId, Collection<Long> mediaAssetIds);
}
