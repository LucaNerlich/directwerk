package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.net.URI;
import java.net.URL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/**
 * Purges a public CDN URL, then tombstones the media asset as {@link AssetStatus#ARCHIVED}.
 */
@Component
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class MediaCdnPurgeJobHandler implements JobHandler {

    private static final Logger log = LoggerFactory.getLogger(MediaCdnPurgeJobHandler.class);

    private final ObjectMapper objectMapper;
    private final CdnPurgeClient cdnPurgeClient;
    private final S3PublicUrlBuilder publicUrlBuilder;
    private final MediaAssetRepository mediaAssetRepository;

    public MediaCdnPurgeJobHandler(
            ObjectMapper objectMapper,
            CdnPurgeClient cdnPurgeClient,
            S3PublicUrlBuilder publicUrlBuilder,
            MediaAssetRepository mediaAssetRepository
    ) {
        this.objectMapper = objectMapper;
        this.cdnPurgeClient = cdnPurgeClient;
        this.publicUrlBuilder = publicUrlBuilder;
        this.mediaAssetRepository = mediaAssetRepository;
    }

    @Override
    public String queueName() {
        return MediaJobQueueNames.MEDIA_CDN_PURGE;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(60L, 30L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        MediaCdnPurgeJobPayload payload = objectMapper.convertValue(job.payload(), MediaCdnPurgeJobPayload.class);
        if (payload == null || payload.mediaAssetId() == null || !StringUtils.hasText(payload.cdnUrl())) {
            throw new IllegalArgumentException("Invalid media CDN purge job payload");
        }

        URL cdnUrl = parseAllowedCdnUrl(payload.cdnUrl());
        cdnPurgeClient.purgeUrl(cdnUrl);

        MediaAsset asset = mediaAssetRepository.findById(payload.mediaAssetId()).orElse(null);
        if (asset == null) {
            log.warn("CDN purge job for missing asset {} — purge already attempted", payload.mediaAssetId());
            return;
        }
        if (asset.getStatus() == AssetStatus.ARCHIVED) {
            return;
        }
        asset.setStatus(AssetStatus.ARCHIVED);
        mediaAssetRepository.saveAndFlush(asset);
    }

    private URL parseAllowedCdnUrl(String cdnUrl) {
        URI uri;
        try {
            uri = URI.create(cdnUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("cdnUrl is not a valid URI", ex);
        }
        if (!uri.isAbsolute() || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            throw new IllegalArgumentException("cdnUrl must be an absolute HTTPS URL");
        }
        URI configured = URI.create(publicUrlBuilder.publicCdnBaseUrl());
        if (configured.getHost() == null || !configured.getHost().equalsIgnoreCase(uri.getHost())) {
            throw new IllegalArgumentException("cdnUrl host does not match configured public CDN base");
        }
        try {
            return uri.toURL();
        } catch (java.net.MalformedURLException ex) {
            throw new IllegalArgumentException("cdnUrl is not a valid URL", ex);
        }
    }
}
