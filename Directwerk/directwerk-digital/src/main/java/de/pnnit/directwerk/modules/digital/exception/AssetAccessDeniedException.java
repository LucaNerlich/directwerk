package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when the caller is not allowed to access or mutate a media asset
 * (role / ownership / scope), distinct from subscription entitlement denial.
 */
public class AssetAccessDeniedException extends RuntimeException {

    public AssetAccessDeniedException(Long mediaAssetId) {
        super("Asset access denied for media asset " + mediaAssetId);
    }
}
