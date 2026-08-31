package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when a media asset cannot be found in the current tenant scope.
 */
public class MediaAssetNotFoundException extends RuntimeException {

    public MediaAssetNotFoundException(Long mediaAssetId) {
        super("Media asset not found: " + mediaAssetId);
    }
}
