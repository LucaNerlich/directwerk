package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when a caller is not entitled to a private media asset.
 */
public class EntitlementDeniedException extends RuntimeException {

    private final Long mediaAssetId;

    public EntitlementDeniedException(Long mediaAssetId) {
        super("Entitlement denied for media asset " + mediaAssetId);
        this.mediaAssetId = mediaAssetId;
    }

    public Long getMediaAssetId() {
        return mediaAssetId;
    }
}
