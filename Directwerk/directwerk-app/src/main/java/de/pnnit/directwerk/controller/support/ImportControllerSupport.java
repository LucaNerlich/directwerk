package de.pnnit.directwerk.controller.support;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Shared helpers for the podcast and newsletter content-import controllers.
 */
public final class ImportControllerSupport {

    private ImportControllerSupport() {
    }

    /**
     * Produces the 16-character dedupe fragment used in bulk-import job keys.
     *
     * @param feedUrl the resolved feed URL
     * @return the first 16 hex characters of the feed URL's SHA-256 digest
     */
    public static String feedHash(String feedUrl) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(feedUrl.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    /**
     * Fails closed when an ingested asset does not belong to the current tenant.
     *
     * <p>Defense in depth: the Hibernate tenantFilter normally scopes this lookup
     * already, but an explicit check keeps cross-tenant reads fail-closed even if
     * the filter is ever bypassed on this path.</p>
     *
     * @param asset   the asset resolved by the caller
     * @param assetId the requested asset id, reported when ownership does not match
     */
    public static void requireTenantOwned(MediaAsset asset, Long assetId) {
        Long tenantId = TenantContext.requireTenantId();
        if (asset.getTenant() == null || !tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(assetId);
        }
    }
}
