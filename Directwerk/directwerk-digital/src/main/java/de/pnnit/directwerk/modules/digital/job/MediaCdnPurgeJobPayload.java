package de.pnnit.directwerk.modules.digital.job;

/**
 * Payload for {@link MediaJobQueueNames#MEDIA_CDN_PURGE}.
 *
 * @param mediaAssetId asset id (tombstoned to ARCHIVED after purge)
 * @param cdnUrl       absolute HTTPS CDN URL built by the application
 */
public record MediaCdnPurgeJobPayload(
        Long mediaAssetId,
        String cdnUrl
) {
}
