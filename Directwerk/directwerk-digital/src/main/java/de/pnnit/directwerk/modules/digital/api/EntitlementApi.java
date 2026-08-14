package de.pnnit.directwerk.modules.digital.api;

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
}
