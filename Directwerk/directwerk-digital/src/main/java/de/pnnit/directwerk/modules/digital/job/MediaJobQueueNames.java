package de.pnnit.directwerk.modules.digital.job;

/**
 * Queue names for media asset background jobs.
 */
public final class MediaJobQueueNames {

    public static final String MEDIA_S3_DELETE = "media-s3-delete";
    public static final String MEDIA_CDN_PURGE = "media-cdn-purge";
    public static final String MEDIA_STAGING_CLEANUP = "media-staging-cleanup";
    public static final String REMOTE_ASSET_INGEST = "remote-asset-ingest";

    private MediaJobQueueNames() {
    }
}
