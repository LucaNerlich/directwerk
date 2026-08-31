package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when a caller is not entitled to a private media asset.
 */
public class EntitlementDeniedException extends RuntimeException {

    public EntitlementDeniedException(Long mediaAssetId) {
        super("Entitlement denied for media asset " + mediaAssetId);
    }
}
