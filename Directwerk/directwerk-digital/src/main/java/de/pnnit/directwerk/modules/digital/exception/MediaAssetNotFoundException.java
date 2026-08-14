package de.pnnit.directwerk.modules.digital.exception;

/**
 * Thrown when a media asset cannot be found in the current tenant scope.
 */
public class MediaAssetNotFoundException extends RuntimeException {

    private final Long mediaAssetId;

    public MediaAssetNotFoundException(Long mediaAssetId) {
        super("Media asset not found: " + mediaAssetId);
        this.mediaAssetId = mediaAssetId;
    }

    public Long getMediaAssetId() {
        return mediaAssetId;
    }
}
