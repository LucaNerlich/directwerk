package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.modules.digital.service.RemoteAssetIngestService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class RemoteAssetIngestJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final RemoteAssetIngestService remoteAssetIngestService;

    public RemoteAssetIngestJobHandler(
            ObjectMapper objectMapper,
            RemoteAssetIngestService remoteAssetIngestService
    ) {
        this.objectMapper = objectMapper;
        this.remoteAssetIngestService = remoteAssetIngestService;
    }

    @Override
    public String queueName() {
        return MediaJobQueueNames.REMOTE_ASSET_INGEST;
    }

    @Override
    public JobHandlerSettings settings() {
        // Large podcast MP3 imports can run for several minutes.
        return new JobHandlerSettings(900L, 60L, 5);
    }

    @Override
    public void handle(QueueJob job) {
        RemoteAssetIngestJobPayload payload = objectMapper.convertValue(
                job.payload(), RemoteAssetIngestJobPayload.class
        );
        if (payload == null || payload.mediaAssetId() == null || payload.mediaAssetId() < 1) {
            throw new IllegalArgumentException("Invalid remote asset ingest job payload");
        }
        if (payload.sourceUrl() == null || payload.sourceUrl().isBlank()) {
            throw new IllegalArgumentException("Remote asset ingest job requires sourceUrl");
        }
        remoteAssetIngestService.processQueuedIngest(payload, job);
    }
}
