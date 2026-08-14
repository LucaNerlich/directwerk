package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import tools.jackson.databind.ObjectMapper;

/**
 * Deletes the S3 object for a media asset, then either archives or enqueues CDN purge.
 */
@Component
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class MediaS3DeleteJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(MediaS3DeleteJobHandler.class);

    private final ObjectMapper objectMapper;
    private final S3Client s3Client;
    private final DirectwerkConfig directwerkConfig;
    private final MediaAssetRepository mediaAssetRepository;
    private final MediaDeleteJobProducer mediaDeleteJobProducer;

    public MediaS3DeleteJobHandler(
            ObjectMapper objectMapper,
            S3Client s3Client,
            DirectwerkConfig directwerkConfig,
            MediaAssetRepository mediaAssetRepository,
            @Lazy MediaDeleteJobProducer mediaDeleteJobProducer
    ) {
        this.objectMapper = objectMapper;
        this.s3Client = s3Client;
        this.directwerkConfig = directwerkConfig;
        this.mediaAssetRepository = mediaAssetRepository;
        this.mediaDeleteJobProducer = mediaDeleteJobProducer;
    }

    @Override
    public String queueName() {
        return MediaJobQueueNames.MEDIA_S3_DELETE;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(120L, 60L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        MediaS3DeleteJobPayload payload = objectMapper.convertValue(job.payload(), MediaS3DeleteJobPayload.class);
        if (payload == null || payload.mediaAssetId() == null || !StringUtils.hasText(payload.s3Key())) {
            throw new IllegalArgumentException("Invalid media S3 delete job payload");
        }

        MediaAsset asset = mediaAssetRepository.findById(payload.mediaAssetId()).orElse(null);
        if (asset == null) {
            log.warn("Media S3 delete job for missing asset {} — treating as complete", payload.mediaAssetId());
            return;
        }
        if (asset.getStatus() == AssetStatus.ARCHIVED) {
            log.debug("Media asset {} already ARCHIVED — skipping S3 delete job", asset.getId());
            return;
        }

        DirectwerkProperties.Storage storage = requireStorage();
        deleteS3Object(storage, payload.s3Key());

        if (StringUtils.hasText(payload.cdnUrl())) {
            mediaDeleteJobProducer.enqueueCdnPurge(payload.mediaAssetId(), payload.cdnUrl());
            return;
        }

        asset.setStatus(AssetStatus.ARCHIVED);
        mediaAssetRepository.saveAndFlush(asset);
    }

    private void deleteS3Object(DirectwerkProperties.Storage storage, String s3Key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(s3Key)
                    .build());
        } catch (NoSuchKeyException ex) {
            log.debug("S3 object already absent for media delete job (idempotent)");
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                log.debug("S3 object already absent (HTTP 404) for media delete job");
                return;
            }
            throw ex;
        }
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
