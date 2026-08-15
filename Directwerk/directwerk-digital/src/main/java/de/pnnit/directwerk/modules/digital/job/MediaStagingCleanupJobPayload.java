package de.pnnit.directwerk.modules.digital.job;

/**
 * Payload for {@link MediaJobQueueNames#MEDIA_STAGING_CLEANUP}.
 *
 * @param stagingKey the staging object key to delete (file plus its session folder marker)
 */
public record MediaStagingCleanupJobPayload(
        String stagingKey
) {
}
