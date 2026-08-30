package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class RemoteAssetIngestJobProducer {

    private final ObjectProvider<QueueService> queueService;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;

    public RemoteAssetIngestJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig
    ) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
    }

    public QueueJob enqueue(Long mediaAssetId, String sourceUrl, String filenameHint) {
        validateQueueAvailability();
        if (mediaAssetId == null || mediaAssetId < 1) {
            throw new IllegalArgumentException("mediaAssetId must be a positive id");
        }
        if (!StringUtils.hasText(sourceUrl)) {
            throw new IllegalArgumentException("sourceUrl is required for remote asset ingest jobs");
        }
        Long tenantId = TenantContext.requireTenantId();
        RemoteAssetIngestJobPayload payload = new RemoteAssetIngestJobPayload(
                mediaAssetId,
                sourceUrl.trim(),
                StringUtils.hasText(filenameHint) ? filenameHint.trim() : null
        );
        return queueService.getObject().enqueue(
                MediaJobQueueNames.REMOTE_ASSET_INGEST,
                objectMapper.valueToTree(payload),
                0,
                null,
                null,
                new JobEnqueueMetadata(tenantId, "remote-asset-ingest-" + mediaAssetId, null)
        );
    }

    public void validateQueueAvailability() {
        if (!directwerkConfig.isQueueEnabled()) {
            throw new UploadValidationException(
                    "REMOTE_ASSET_FAILED",
                    "Background remote ingest requires the job queue to be enabled"
            );
        }
    }
}
