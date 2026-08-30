package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Wires S3-compatible clients when {@code directwerk.storage.enabled=true}.
 */
@Configuration
public class S3StorageConfig {

    @Bean
    S3PublicUrlBuilder s3PublicUrlBuilder(DirectwerkConfig directwerkConfig) {
        DirectwerkProperties.Storage storage = requireStorage(directwerkConfig);
        String baseUrl = storage.publicCdnBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException(
                    "directwerk.storage.public-cdn-base-url is required for AssetAccessApi"
            );
        }
        return new S3PublicUrlBuilder(baseUrl);
    }

    @Bean
    @ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
    S3Client s3Client(DirectwerkConfig directwerkConfig) {
        DirectwerkProperties.Storage storage = requireConfiguredCredentials(directwerkConfig);
        URI endpointUri = validateEndpoint(storage.endpoint());
        Duration uploadTimeout = storage.presignUploadTtl() != null
                ? storage.presignUploadTtl()
                : Duration.ofMinutes(15);
        return S3Client.builder()
                .endpointOverride(endpointUri)
                .region(Region.of(storage.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(storage.forcePathStyle())
                        .build())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(uploadTimeout)
                        .apiCallAttemptTimeout(uploadTimeout)
                        .build())
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
    S3Presigner s3Presigner(DirectwerkConfig directwerkConfig) {
        DirectwerkProperties.Storage storage = requireConfiguredCredentials(directwerkConfig);
        URI endpointUri = validateEndpoint(storage.endpoint());
        return S3Presigner.builder()
                .endpointOverride(endpointUri)
                .region(Region.of(storage.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(storage.forcePathStyle())
                        .build())
                .build();
    }

    private static DirectwerkProperties.Storage requireStorage(DirectwerkConfig config) {
        DirectwerkProperties.Storage storage = config.storage();
        if (storage == null) {
            throw new IllegalStateException("directwerk.storage configuration is missing");
        }
        return storage;
    }

    private static DirectwerkProperties.Storage requireConfiguredCredentials(DirectwerkConfig config) {
        DirectwerkProperties.Storage storage = requireStorage(config);
        if (storage.endpoint() == null || storage.endpoint().isBlank()) {
            throw new IllegalStateException("directwerk.storage.endpoint is required when storage is enabled");
        }
        if (storage.bucket() == null || storage.bucket().isBlank()) {
            throw new IllegalStateException("directwerk.storage.bucket is required when storage is enabled");
        }
        if (storage.accessKey() == null || storage.accessKey().isBlank()) {
            throw new IllegalStateException("directwerk.storage.access-key is required when storage is enabled");
        }
        if (storage.secretKey() == null || storage.secretKey().isBlank()) {
            throw new IllegalStateException("directwerk.storage.secret-key is required when storage is enabled");
        }
        if (storage.region() == null || storage.region().isBlank()) {
            throw new IllegalStateException("directwerk.storage.region is required when storage is enabled");
        }
        return storage;
    }

    private static URI validateEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalStateException("directwerk.storage.endpoint is required when storage is enabled");
        }
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("directwerk.storage.endpoint must be a valid URI", ex);
        }
        if (!uri.isAbsolute()) {
            throw new IllegalStateException("directwerk.storage.endpoint must be an absolute URI");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalStateException("directwerk.storage.endpoint must use HTTPS scheme");
        }
        if (uri.getHost() == null) {
            throw new IllegalStateException("directwerk.storage.endpoint must have a valid host");
        }
        return uri;
    }
}
