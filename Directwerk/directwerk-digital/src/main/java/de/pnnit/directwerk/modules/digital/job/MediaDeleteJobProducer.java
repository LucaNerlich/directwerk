package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * Typed producer for media S3 delete and CDN purge jobs.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class MediaDeleteJobProducer {

    private final QueueService queueService;
    private final ObjectMapper objectMapper;

    public MediaDeleteJobProducer(QueueService queueService, ObjectMapper objectMapper) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
    }

    public QueueJob enqueueS3Delete(Long mediaAssetId, String s3Key, String cdnUrl) {
        if (mediaAssetId == null || mediaAssetId < 1) {
            throw new IllegalArgumentException("mediaAssetId must be a positive id");
        }
        if (!StringUtils.hasText(s3Key)) {
            throw new IllegalArgumentException("s3Key is required for media S3 delete jobs");
        }
        Long tenantId = TenantContext.requireTenantId();
        MediaS3DeleteJobPayload payload = new MediaS3DeleteJobPayload(
                mediaAssetId,
                s3Key.trim(),
                StringUtils.hasText(cdnUrl) ? cdnUrl.trim() : null
        );
        return queueService.enqueue(
                MediaJobQueueNames.MEDIA_S3_DELETE,
                objectMapper.valueToTree(payload),
                0,
                null,
                null,
                new JobEnqueueMetadata(tenantId, "media-s3-delete-" + mediaAssetId, null)
        );
    }

    public QueueJob enqueueCdnPurge(Long mediaAssetId, String cdnUrl) {
        if (mediaAssetId == null || mediaAssetId < 1) {
            throw new IllegalArgumentException("mediaAssetId must be a positive id");
        }
        if (!StringUtils.hasText(cdnUrl)) {
            throw new IllegalArgumentException("cdnUrl is required for media CDN purge jobs");
        }
        Long tenantId = TenantContext.requireTenantId();
        MediaCdnPurgeJobPayload payload = new MediaCdnPurgeJobPayload(mediaAssetId, cdnUrl.trim());
        return queueService.enqueue(
                MediaJobQueueNames.MEDIA_CDN_PURGE,
                objectMapper.valueToTree(payload),
                0,
                null,
                null,
                new JobEnqueueMetadata(tenantId, "media-cdn-purge-" + mediaAssetId, null)
        );
    }
}
