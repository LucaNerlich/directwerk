package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.storage.BunnyTokenUrlSigner;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
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
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/**
 * Maintains S3 as the sole source of truth for generated RSS XML.
 * Feed tokens are deliberately excluded from object keys and logs.
 */
@Service
public class RssFeedSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(RssFeedSnapshotService.class);
    private static final String RSS_CONTENT_TYPE = "application/rss+xml; charset=UTF-8";
    private static final Duration DEFAULT_PRIVATE_TTL = Duration.ofHours(24);

    private final RssFeedService rssFeedService;
    private final TenantRepository tenantRepository;
    private final TenantDomainRepository tenantDomainRepository;
    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    private final PodcastSeriesRepository podcastSeriesRepository;
    private final SubscriberFeedRepository subscriberFeedRepository;
    private final RssSnapshotStateStore snapshotStateStore;
    private final ObjectProvider<S3Client> s3Client;
    private final ObjectProvider<S3Presigner> s3Presigner;
    private final ObjectProvider<CdnPurgeClient> cdnPurgeClient;
    private final S3PublicUrlBuilder publicUrlBuilder;
    private final DirectwerkConfig directwerkConfig;

    public RssFeedSnapshotService(
            RssFeedService rssFeedService,
            TenantRepository tenantRepository,
            TenantDomainRepository tenantDomainRepository,
            TenantModuleActivationRepository tenantModuleActivationRepository,
            PodcastSeriesRepository podcastSeriesRepository,
            SubscriberFeedRepository subscriberFeedRepository,
            RssSnapshotStateStore snapshotStateStore,
            ObjectProvider<S3Client> s3Client,
            ObjectProvider<S3Presigner> s3Presigner,
            ObjectProvider<CdnPurgeClient> cdnPurgeClient,
            S3PublicUrlBuilder publicUrlBuilder,
            DirectwerkConfig directwerkConfig
    ) {
        this.rssFeedService = rssFeedService;
        this.tenantRepository = tenantRepository;
        this.tenantDomainRepository = tenantDomainRepository;
        this.tenantModuleActivationRepository = tenantModuleActivationRepository;
        this.podcastSeriesRepository = podcastSeriesRepository;
        this.subscriberFeedRepository = subscriberFeedRepository;
        this.snapshotStateStore = snapshotStateStore;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.cdnPurgeClient = cdnPurgeClient;
        this.publicUrlBuilder = publicUrlBuilder;
        this.directwerkConfig = directwerkConfig;
    }

    public FeedDelivery publicTenantFeed(Tenant tenant) {
        return deliver(publicTenantRef(tenant));
    }

    public FeedDelivery publicSeriesFeed(
            Tenant tenant,
            PodcastSeries series
    ) {
        return deliver(publicSeriesRef(tenant, series.getId()));
    }

    public FeedDelivery privateFeed(Tenant tenant, SubscriberFeed feed) {
        return deliver(privateFeedRef(tenant, feed.getId()));
    }

    /**
     * Reconciles S3 snapshots with the tenant's current RSS module and feed state.
     * When {@code PODCAST_RSS} is off, every snapshot is deleted and public/private
     * pull-zone URLs are purged. Disabled subscriber feeds are removed the same way.
     */
    public void refreshTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown tenant id: " + tenantId));
        withdrawStalePrefixes(tenant);
        if (!rssModuleActive(tenantId)) {
            if (!directwerkConfig.isStorageEnabled()) {
                snapshotStateStore.clearWritten(tenantId);
                return;
            }
            withdrawTenant(tenant);
            snapshotStateStore.clearWritten(tenantId);
            return;
        }
        Origin origin = canonicalOrigin(tenantId);

        refresh(publicTenantRef(tenant), () -> rssFeedService.buildPublicFeed(
                tenant, null, origin.scheme(), origin.host(), origin.port()
        ));
        // Rebuild draft/unpublished series too: an old public object must become empty,
        // rather than continue serving episodes from a previous published snapshot.
        podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenantId)
                .forEach(series -> refresh(publicSeriesRef(tenant, series.getId()), () -> rssFeedService.buildPublicFeed(
                        tenant, series, origin.scheme(), origin.host(), origin.port()
                )));
        boolean feedBuilderActive = feedBuilderModuleActive(tenantId);
        subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenantId)
                .forEach(feed -> {
                    boolean customFeedBlocked = !feed.isDefaultFeed() && !feedBuilderActive;
                    if (feed.isEnabled() && !customFeedBlocked) {
                        refresh(privateFeedRef(tenant, feed.getId()), () -> rssFeedService.buildPrivateFeed(
                                tenant, feed, origin.scheme(), origin.host(), origin.port()
                        ));
                    } else {
                        withdraw(privateFeedRef(tenant, feed.getId()));
                    }
                });
    }

    /**
     * Removes a private feed snapshot immediately (disable/delete). Safe when storage is off:
     * only the presence row is cleared so a later refresh cannot serve a stale object.
     */
    public void withdrawPrivateFeed(Tenant tenant, Long feedId) {
        if (tenant == null || feedId == null) {
            return;
        }
        if (!directwerkConfig.isStorageEnabled()) {
            snapshotStateStore.clearWritten(tenant.getId(), RssSnapshotKind.PRIVATE_FEED, feedId);
            return;
        }
        withdraw(privateFeedRef(tenant, feedId));
    }

    private FeedDelivery deliver(SnapshotRef ref) {
        requireStorage();
        if (!snapshotStateStore.isWritten(ref.tenantId(), ref.kind(), ref.subjectId())) {
            return FeedDelivery.notReady();
        }
        return new FeedDelivery(remoteUrl(ref));
    }

    private void withdrawStalePrefixes(Tenant tenant) {
        for (String staleSlug : snapshotStateStore.stalePrefixes(tenant.getId())) {
            if (!staleSlug.equals(tenant.getSlug())) {
                if (directwerkConfig.isStorageEnabled()) {
                    withdrawTenantAtSlug(tenant, staleSlug);
                }
            }
            snapshotStateStore.clearStalePrefix(tenant.getId(), staleSlug);
        }
    }

    private void withdrawTenant(Tenant tenant) {
        withdrawTenantAtSlug(tenant, tenant.getSlug());
    }

    private void withdrawTenantAtSlug(Tenant tenant, String slug) {
        withdraw(publicTenantRef(tenant.getId(), slug));
        podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(tenant.getId())
                .forEach(series -> withdraw(publicSeriesRef(tenant.getId(), slug, series.getId())));
        subscriberFeedRepository.findByTenantIdOrderByIdAsc(tenant.getId())
                .forEach(feed -> withdraw(privateFeedRef(tenant.getId(), slug, feed.getId())));
    }

    private void refresh(SnapshotRef ref, XmlSupplier supplier) {
        String xml = supplier.get();
        byte[] bytes = xml.getBytes(StandardCharsets.UTF_8);
        upload(ref, bytes);
    }

    private void upload(SnapshotRef ref, byte[] bytes) {
        TenantAssetKeys.requireTenantPrefix(ref.tenantSlug(), ref.objectKey());
        s3Client().putObject(PutObjectRequest.builder()
                        .bucket(requireStorage().bucket())
                        .key(ref.objectKey())
                        .contentType(RSS_CONTENT_TYPE)
                        .cacheControl(ref.privateFeed() ? "private, max-age=300" : "public, max-age=300")
                        .build(),
                RequestBody.fromBytes(bytes));
        snapshotStateStore.markWritten(ref.tenantId(), ref.kind(), ref.subjectId());
    }

    private void withdraw(SnapshotRef ref) {
        TenantAssetKeys.requireTenantPrefix(ref.tenantSlug(), ref.objectKey());
        DirectwerkProperties.Storage storage = requireStorage();
        try {
            s3Client().deleteObject(DeleteObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(ref.objectKey())
                    .build());
        } catch (NoSuchKeyException ex) {
            log.debug("RSS snapshot already absent for tenant prefix {}", ref.tenantSlug());
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                log.debug("RSS snapshot already absent (HTTP 404) for tenant prefix {}", ref.tenantSlug());
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

    private URL remoteUrl(SnapshotRef ref) {
        DirectwerkProperties.Storage storage = requireStorage();
        if (!ref.privateFeed()) {
            return publicUrlBuilder.cdnUrl(ref.objectKey());
        }
        boolean hasPrivateCdn = StringUtils.hasText(storage.privateCdnBaseUrl());
        boolean hasTokenKey = StringUtils.hasText(storage.cdnTokenAuthKey());
        Duration ttl = storage.presignDownloadTtlRss() != null
                ? storage.presignDownloadTtlRss()
                : DEFAULT_PRIVATE_TTL;
        if (hasPrivateCdn && hasTokenKey) {
            return BunnyTokenUrlSigner.signObjectGet(
                    storage.privateCdnBaseUrl(), ref.objectKey(), storage.cdnTokenAuthKey(), ttl
            );
        }
        if (hasPrivateCdn || hasTokenKey) {
            throw new StorageNotConfiguredException(
                    "Private CDN token auth requires both private-cdn-base-url and cdn-token-auth-key"
            );
        }
        S3Presigner presigner = Optional.ofNullable(s3Presigner.getIfAvailable())
                .orElseThrow(() -> new StorageNotConfiguredException("Object storage is enabled without an S3 presigner"));
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(ttl)
                        .getObjectRequest(GetObjectRequest.builder()
                                .bucket(storage.bucket())
                                .key(ref.objectKey())
                                .build())
                        .build())
                .url();
    }

    /**
     * Unsigned pull-zone object URL used for CDN purge. Never includes token-auth
     * or S3 presign query parameters.
     */
    private URL unsignedCdnUrl(SnapshotRef ref) {
        if (!ref.privateFeed()) {
            return publicUrlBuilder.cdnUrl(ref.objectKey());
        }
        String base = requireStorage().privateCdnBaseUrl();
        if (!StringUtils.hasText(base)) {
            return null;
        }
        String trimmed = trimTrailingSlash(base);
        try {
            URI uri = URI.create(trimmed);
            if (!uri.isAbsolute() || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                log.warn("Skipping private RSS CDN purge — private-cdn-base-url is not absolute HTTPS");
                return null;
            }
            return URI.create(trimmed + "/" + ref.objectKey()).toURL();
        } catch (IllegalArgumentException | MalformedURLException ex) {
            log.warn("Skipping private RSS CDN purge — private-cdn-base-url is invalid");
            return null;
        }
    }

    private boolean rssModuleActive(Long tenantId) {
        return moduleActive(tenantId, PodcastRssModule.KEY);
    }

    private boolean feedBuilderModuleActive(Long tenantId) {
        return moduleActive(tenantId, FeedBuilderModule.KEY);
    }

    private boolean moduleActive(Long tenantId, String moduleKey) {
        return tenantModuleActivationRepository.findByTenantIdAndModuleKey(tenantId, moduleKey)
                .map(activation -> activation.isActive())
                .orElse(false);
    }

    private S3Client s3Client() {
        if (!directwerkConfig.isStorageEnabled()) {
            throw new StorageNotConfiguredException("Object storage is required for RSS feed delivery");
        }
        return Optional.ofNullable(s3Client.getIfAvailable())
                .orElseThrow(() -> new StorageNotConfiguredException("Object storage is enabled without an S3 client"));
    }

    private DirectwerkProperties.Storage requireStorage() {
        if (!directwerkConfig.isStorageEnabled()) {
            throw new StorageNotConfiguredException("Object storage is required for RSS feed delivery");
        }
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        if (storage == null || !StringUtils.hasText(storage.bucket())) {
            throw new StorageNotConfiguredException("Object storage bucket is not configured");
        }
        return storage;
    }

    private Origin canonicalOrigin(Long tenantId) {
        TenantDomain domain = tenantDomainRepository.findByTenantId(tenantId).stream()
                .filter(TenantDomain::isVerified)
                .sorted((left, right) -> Boolean.compare(right.isPrimary(), left.isPrimary()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Cannot refresh RSS snapshots without a verified tenant domain"
                ));
        return new Origin("https", domain.getHost(), 443);
    }

    private SnapshotRef publicTenantRef(Tenant tenant) {
        return publicTenantRef(tenant.getId(), tenant.getSlug());
    }

    private SnapshotRef publicTenantRef(Long tenantId, String slug) {
        return ref(tenantId, slug, "public/rss/podcast.xml", false, RssSnapshotKind.TENANT, RssSnapshotStateStore.TENANT_SUBJECT_ID);
    }

    private SnapshotRef publicSeriesRef(Tenant tenant, Long seriesId) {
        return publicSeriesRef(tenant.getId(), tenant.getSlug(), seriesId);
    }

    private SnapshotRef publicSeriesRef(Long tenantId, String slug, Long seriesId) {
        return ref(tenantId, slug, "public/rss/series-" + seriesId + ".xml", false, RssSnapshotKind.SERIES, seriesId);
    }

    private SnapshotRef privateFeedRef(Tenant tenant, Long feedId) {
        return privateFeedRef(tenant.getId(), tenant.getSlug(), feedId);
    }

    private SnapshotRef privateFeedRef(Long tenantId, String slug, Long feedId) {
        return ref(tenantId, slug, "private/rss/feed-" + feedId + ".xml", true, RssSnapshotKind.PRIVATE_FEED, feedId);
    }

    private SnapshotRef ref(
            Long tenantId,
            String tenantSlug,
            String objectSuffix,
            boolean privateFeed,
            RssSnapshotKind kind,
            long subjectId
    ) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("Tenant must have a persistent id");
        }
        return new SnapshotRef(tenantId, tenantSlug, tenantSlug + "/" + objectSuffix, privateFeed, kind, subjectId);
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

    private record SnapshotRef(
            Long tenantId,
            String tenantSlug,
            String objectKey,
            boolean privateFeed,
            RssSnapshotKind kind,
            long subjectId
    ) {
    }

    private record Origin(String scheme, String host, int port) {
    }

    @FunctionalInterface
    private interface XmlSupplier {
        String get();
    }
}
