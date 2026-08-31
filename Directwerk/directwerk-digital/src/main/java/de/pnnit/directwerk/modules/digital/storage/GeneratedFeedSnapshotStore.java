package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Maintains S3 as the sole source of truth for generated feed XML (podcast RSS, article RSS,
 * or any future generated-feed content type). Feed tokens are never part of an object key or
 * a log line — callers key private snapshots by numeric subject id instead.
 */
@Service
public class GeneratedFeedSnapshotStore {

    private static final Logger log = LoggerFactory.getLogger(GeneratedFeedSnapshotStore.class);
    private static final Duration DEFAULT_PRIVATE_TTL = Duration.ofHours(24);

    private final FeedSnapshotStateStore snapshotStateStore;
    private final ObjectProvider<S3Client> s3Client;
    private final PrivateObjectUrlSigner privateObjectUrlSigner;
    private final ObjectProvider<CdnPurgeClient> cdnPurgeClient;
    private final S3PublicUrlBuilder publicUrlBuilder;
    private final DirectwerkConfig directwerkConfig;

    public GeneratedFeedSnapshotStore(
            FeedSnapshotStateStore snapshotStateStore,
            ObjectProvider<S3Client> s3Client,
            PrivateObjectUrlSigner privateObjectUrlSigner,
            ObjectProvider<CdnPurgeClient> cdnPurgeClient,
            S3PublicUrlBuilder publicUrlBuilder,
            DirectwerkConfig directwerkConfig
    ) {
        this.snapshotStateStore = snapshotStateStore;
        this.s3Client = s3Client;
        this.privateObjectUrlSigner = privateObjectUrlSigner;
        this.cdnPurgeClient = cdnPurgeClient;
        this.publicUrlBuilder = publicUrlBuilder;
        this.directwerkConfig = directwerkConfig;
    }

    public FeedDelivery deliver(FeedSnapshotRef ref) {
        StorageConfigs.requireEnabled(directwerkConfig);
        if (!snapshotStateStore.isWritten(ref.tenantId(), ref.kind(), ref.subjectId())) {
            return FeedDelivery.notReady();
        }
        return new FeedDelivery(remoteUrl(ref));
    }

    public void upload(FeedSnapshotRef ref, byte[] bytes, String contentType) {
        TenantAssetKeys.requireTenantPrefix(ref.tenantSlug(), ref.objectKey());
        s3Client().putObject(PutObjectRequest.builder()
                        .bucket(StorageConfigs.requireEnabled(directwerkConfig).bucket())
                        .key(ref.objectKey())
                        .contentType(contentType)
                        .cacheControl(ref.privateFeed() ? "private, max-age=300" : "public, max-age=300")
                        .build(),
                RequestBody.fromBytes(bytes));
        snapshotStateStore.markWritten(ref.tenantId(), ref.kind(), ref.subjectId());
    }

    public void upload(FeedSnapshotRef ref, String xml, String contentType) {
        upload(ref, xml.getBytes(StandardCharsets.UTF_8), contentType);
    }

    public void withdraw(FeedSnapshotRef ref) {
        TenantAssetKeys.requireTenantPrefix(ref.tenantSlug(), ref.objectKey());
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        try {
            s3Client().deleteObject(DeleteObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(ref.objectKey())
                    .build());
        } catch (NoSuchKeyException ex) {
            log.debug("Feed snapshot already absent for tenant prefix {}", ref.tenantSlug());
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                log.debug("Feed snapshot already absent (HTTP 404) for tenant prefix {}", ref.tenantSlug());
            } else {
                throw ex;
            }
        }
        URL purgeTarget = unsignedCdnUrl(ref);
        CdnPurgeClient purger = cdnPurgeClient.getIfAvailable();
        if (purgeTarget != null && purger != null) {
            purger.purgeUrl(purgeTarget);
        }
        snapshotStateStore.clearWritten(ref.tenantId(), ref.kind(), ref.subjectId());
    }

    private URL remoteUrl(FeedSnapshotRef ref) {
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        if (!ref.privateFeed()) {
            return publicUrlBuilder.cdnUrl(ref.objectKey());
        }
        Duration ttl = storage.presignDownloadTtlRss() != null
                ? storage.presignDownloadTtlRss()
                : DEFAULT_PRIVATE_TTL;
        // Shared delivery policy — same decision tree as API downloads by construction.
        return privateObjectUrlSigner.signPrivateObject(ref.objectKey(), ttl);
    }

    /**
     * Unsigned pull-zone object URL used for CDN purge. Never includes token-auth
     * or S3 presign query parameters.
     */
    private URL unsignedCdnUrl(FeedSnapshotRef ref) {
        if (!ref.privateFeed()) {
            return publicUrlBuilder.cdnUrl(ref.objectKey());
        }
        String base = StorageConfigs.requireEnabled(directwerkConfig).privateCdnBaseUrl();
        if (!StringUtils.hasText(base)) {
            return null;
        }
        String trimmed = trimTrailingSlash(base);
        try {
            URI uri = URI.create(trimmed);
            if (!uri.isAbsolute() || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                log.warn("Skipping private feed CDN purge — private-cdn-base-url is not absolute HTTPS");
                return null;
            }
            return URI.create(trimmed + "/" + ref.objectKey()).toURL();
        } catch (IllegalArgumentException | MalformedURLException ex) {
            log.warn("Skipping private feed CDN purge — private-cdn-base-url is invalid");
            return null;
        }
    }

    private S3Client s3Client() {
        if (!directwerkConfig.isStorageEnabled()) {
            throw new StorageNotConfiguredException("Object storage is required for feed delivery");
        }
        return Optional.ofNullable(s3Client.getIfAvailable())
                .orElseThrow(() -> new StorageNotConfiguredException("Object storage is enabled without an S3 client"));
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    public record FeedDelivery(URL redirectUrl) {
        public boolean ready() {
            return redirectUrl != null;
        }

        public static FeedDelivery notReady() {
            return new FeedDelivery(null);
        }
    }
}
