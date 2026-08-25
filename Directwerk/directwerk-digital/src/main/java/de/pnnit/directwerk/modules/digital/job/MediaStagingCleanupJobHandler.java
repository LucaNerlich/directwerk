package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * Retries deletion of a staging object (and its session folder marker) after the inline cleanup in
 * {@code UploadService.confirmUpload} failed, e.g. because S3 was temporarily unavailable.
 */
@Component
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class MediaStagingCleanupJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(MediaStagingCleanupJobHandler.class);

    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;
    private final StagingCleanupService stagingCleanupService;

    public MediaStagingCleanupJobHandler(
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            StagingCleanupService stagingCleanupService
    ) {
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
        this.stagingCleanupService = stagingCleanupService;
    }

    @Override
    public String queueName() {
        return MediaJobQueueNames.MEDIA_STAGING_CLEANUP;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(120L, 60L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        MediaStagingCleanupJobPayload payload =
                objectMapper.convertValue(job.payload(), MediaStagingCleanupJobPayload.class);
        if (payload == null || !StringUtils.hasText(payload.stagingKey())) {
            throw new IllegalArgumentException("Invalid media staging cleanup job payload");
        }

        DirectwerkProperties.Storage storage = requireStorage();
        stagingCleanupService.deleteStagingKeyAndFolder(storage.bucket(), payload.stagingKey());
        log.debug("Staging cleanup job deleted staging key {}", payload.stagingKey());
    }

    private DirectwerkProperties.Storage requireStorage() {
        if (!directwerkConfig.isStorageEnabled()) {
            throw new StorageNotConfiguredException("Object storage is disabled");
        }
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        if (storage == null || storage.bucket() == null || storage.bucket().isBlank()) {
            throw new StorageNotConfiguredException("Object storage bucket is not configured");
        }
        return storage;
    }
}
