package de.pnnit.directwerk.modules.digital.job;

/**
 * Payload for {@link MediaJobQueueNames#MEDIA_S3_DELETE}.
 *
 * @param mediaAssetId asset id
 * @param s3Key        object key to delete (snapshotted at enqueue)
 * @param cdnUrl       public CDN URL to purge after S3 delete; null when no purge needed
 */
public record MediaS3DeleteJobPayload(
        Long mediaAssetId,
        String s3Key,
        String cdnUrl
) {
}
