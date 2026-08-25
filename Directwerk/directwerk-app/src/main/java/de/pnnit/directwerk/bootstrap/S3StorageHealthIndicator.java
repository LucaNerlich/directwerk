package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

/**
 * Verifies the configured bucket is reachable when S3 clients are enabled.
 * Uses the same property gate as {@code S3StorageConfig} (not {@code @ConditionalOnBean}),
 * so component-scan order cannot skip this indicator after storage is turned on.
 */
@Component("s3StorageHealthIndicator")
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class S3StorageHealthIndicator implements HealthIndicator {

    private final S3Client s3Client;
    private final DirectwerkConfig directwerkConfig;

    public S3StorageHealthIndicator(S3Client s3Client, DirectwerkConfig directwerkConfig) {
        this.s3Client = s3Client;
        this.directwerkConfig = directwerkConfig;
    }

    @Override
    public Health health() {
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        String bucket = storage != null ? storage.bucket() : null;
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            return Health.up()
                    .withDetails(Map.of(
                            "bucket", bucket == null ? "" : bucket,
                            "provider", storage == null || storage.provider() == null ? "" : storage.provider()
                    ))
                    .build();
        } catch (RuntimeException ex) {
            return Health.down(ex)
                    .withDetail("bucket", bucket == null ? "" : bucket)
                    .build();
        }
    }
}
