package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedRepository;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.testsupport.TestObjectProviders;
import java.net.URL;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

class RssFeedSnapshotServiceTest {

    @Test
    void feedRequestRedirectsWithoutGeneratingXmlWhenSnapshotIsWritten() {
        Fixture fixture = fixture();
        when(fixture.stateStore.isWritten(10L, RssSnapshotKind.TENANT.name(), 0L)).thenReturn(true);

        var delivery = fixture.service.publicTenantFeed(fixture.tenant);

        assertThat(delivery.ready()).isTrue();
        assertThat(delivery.redirectUrl().toString())
                .isEqualTo("https://public.example.test/alpha/public/rss/podcast.xml");
        verify(fixture.rssFeedService, times(0)).buildPublicFeed(any(), any(), any(), any(), any(Integer.class));
        verify(fixture.s3Client, times(0)).putObject(
                any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)
        );
    }

    @Test
    void feedRequestReturnsNotReadyWhenSnapshotHasNotBeenWritten() {
        Fixture fixture = fixture();
        when(fixture.stateStore.isWritten(10L, RssSnapshotKind.TENANT.name(), 0L)).thenReturn(false);

        var delivery = fixture.service.publicTenantFeed(fixture.tenant);

        assertThat(delivery.ready()).isFalse();
        assertThat(delivery.redirectUrl()).isNull();
        verify(fixture.s3Client, never()).headObject(any(software.amazon.awssdk.services.s3.model.HeadObjectRequest.class));
    }

    @Test
    void privateSnapshotUsesPrivatePrefixAndSignedPullZoneWithoutTokenInObjectKey() {
        Fixture fixture = fixture();
        when(fixture.stateStore.isWritten(10L, RssSnapshotKind.PRIVATE_FEED.name(), 42L)).thenReturn(true);
        when(fixture.storage.privateCdnBaseUrl()).thenReturn("https://private.example.test");
        when(fixture.storage.cdnTokenAuthKey()).thenReturn("test-signing-key");
        when(fixture.storage.presignDownloadTtlRss()).thenReturn(Duration.ofHours(1));
        User user = new User();
        user.setId(99L);
        SubscriberFeed feed = new SubscriberFeed();
        feed.setId(42L);
        feed.setTenant(fixture.tenant);
        feed.setUser(user);
        feed.setFeedToken("secret-feed-token");
        feed.setEnabled(true);
        when(fixture.rssFeedService.buildPrivateFeed(
                fixture.tenant, feed, "https", "alpha.example.test", 443
        )).thenReturn("<rss>private</rss>");

        var delivery = fixture.service.privateFeed(fixture.tenant, feed);

        assertThat(delivery.redirectUrl().getHost()).isEqualTo("private.example.test");
        assertThat(delivery.redirectUrl().toString()).doesNotContain("secret-feed-token");
        assertThat(delivery.redirectUrl().getPath()).isEqualTo("/alpha/private/rss/feed-42.xml");
    }

    @Test
    void refreshJobUploadsTheCanonicalS3ObjectAndMarksItWritten() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(10L)).thenReturn(List.of());
        when(fixture.subscriberFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(fixture.rssFeedService.buildPublicFeed(
                fixture.tenant, null, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(fixture.s3Client).putObject(request.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertThat(request.getValue().key()).isEqualTo("alpha/public/rss/podcast.xml");
        verify(fixture.s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(fixture.stateStore).markWritten(10L, RssSnapshotKind.TENANT.name(), 0L);
    }

    @Test
    void refreshWhenRssModuleOffDeletesPublicSnapshotAndPurgesCdn() {
        Fixture fixture = fixture();
        when(fixture.tenantRepository.findById(10L)).thenReturn(Optional.of(fixture.tenant));
        when(fixture.moduleGateService.isModuleActive(10L, "PODCAST_RSS"))
                .thenReturn(false);
        when(fixture.podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(10L)).thenReturn(List.of());
        when(fixture.subscriberFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of());

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/public/rss/podcast.xml");
        verify(fixture.s3Client, never()).putObject(
                any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)
        );
        ArgumentCaptor<URL> purged = ArgumentCaptor.forClass(URL.class);
        verify(fixture.cdnPurgeClient).purgeUrl(purged.capture());
        assertThat(purged.getValue().toString())
                .isEqualTo("https://public.example.test/alpha/public/rss/podcast.xml");
        verify(fixture.stateStore).clearWritten(10L);
    }

    @Test
    void refreshDeletesDisabledPrivateFeedAndPurgesPrivateCdn() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.storage.privateCdnBaseUrl()).thenReturn("https://private.example.test");
        when(fixture.podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(10L)).thenReturn(List.of());
        when(fixture.rssFeedService.buildPublicFeed(
                fixture.tenant, null, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");
        SubscriberFeed disabled = new SubscriberFeed();
        disabled.setId(42L);
        disabled.setTenant(fixture.tenant);
        disabled.setEnabled(false);
        when(fixture.subscriberFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of(disabled));

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/private/rss/feed-42.xml");
        ArgumentCaptor<URL> purged = ArgumentCaptor.forClass(URL.class);
        verify(fixture.cdnPurgeClient).purgeUrl(purged.capture());
        assertThat(purged.getValue().toString())
                .isEqualTo("https://private.example.test/alpha/private/rss/feed-42.xml");
        assertThat(purged.getValue().getQuery()).isNull();
        verify(fixture.stateStore).clearWritten(10L, RssSnapshotKind.PRIVATE_FEED.name(), 42L);
    }

    @Test
    void refreshWithdrawsEnabledCustomFeedWhenFeedBuilderModuleIsOff() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.storage.privateCdnBaseUrl()).thenReturn("https://private.example.test");
        when(fixture.podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(10L)).thenReturn(List.of());
        when(fixture.rssFeedService.buildPublicFeed(
                fixture.tenant, null, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");
        SubscriberFeed custom = new SubscriberFeed();
        custom.setId(42L);
        custom.setTenant(fixture.tenant);
        custom.setDefaultFeed(false);
        custom.setEnabled(true);
        when(fixture.subscriberFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of(custom));

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/private/rss/feed-42.xml");
        verify(fixture.rssFeedService, never()).buildPrivateFeed(any(), any(), any(), any(), any(Integer.class));
    }

    @Test
    void refreshWithdrawsObjectsUnderAPreviousTenantSlug() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.stateStore.stalePrefixes(10L)).thenReturn(List.of("old-alpha"));
        when(fixture.podcastSeriesRepository.findByTenantIdOrderByTitleAscIdAsc(10L)).thenReturn(List.of());
        when(fixture.subscriberFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(fixture.rssFeedService.buildPublicFeed(
                fixture.tenant, null, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("old-alpha/public/rss/podcast.xml");
        verify(fixture.stateStore).clearStalePrefix(10L, "old-alpha");
        verify(fixture.s3Client).putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class));
    }

    private Fixture fixture() {
        RssFeedService rssFeedService = mock(RssFeedService.class);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        TenantPublicHostResolver tenantPublicHostResolver = mock(TenantPublicHostResolver.class);
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        PodcastSeriesRepository podcastSeriesRepository = mock(PodcastSeriesRepository.class);
        SubscriberFeedRepository subscriberFeedRepository = mock(SubscriberFeedRepository.class);
        FeedSnapshotStateStore stateStore = mock(FeedSnapshotStateStore.class);
        S3Client s3Client = mock(S3Client.class);
        CdnPurgeClient cdnPurgeClient = mock(CdnPurgeClient.class);
        ObjectProvider<S3Client> s3ClientProvider = TestObjectProviders.returning(s3Client);
        ObjectProvider<S3Presigner> s3PresignerProvider = TestObjectProviders.empty();
        ObjectProvider<CdnPurgeClient> cdnPurgeProvider = TestObjectProviders.returning(cdnPurgeClient);
        DirectwerkConfig directwerkConfig = mock(DirectwerkConfig.class);
        DirectwerkProperties.Storage storage = mock(DirectwerkProperties.Storage.class);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(storage.bucket()).thenReturn("feeds");
        when(directwerkConfig.storage()).thenReturn(storage);
        when(stateStore.stalePrefixes(10L)).thenReturn(List.of());

        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        GeneratedFeedSnapshotStore snapshotStore = new GeneratedFeedSnapshotStore(
                stateStore,
                s3ClientProvider,
                new de.pnnit.directwerk.modules.digital.storage.PrivateObjectUrlSigner(directwerkConfig, s3PresignerProvider),
                cdnPurgeProvider,
                new S3PublicUrlBuilder("https://public.example.test"),
                directwerkConfig
        );
        RssFeedSnapshotService service = new RssFeedSnapshotService(
                rssFeedService,
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                podcastSeriesRepository,
                subscriberFeedRepository,
                stateStore,
                snapshotStore,
                directwerkConfig
        );
        return new Fixture(
                service,
                rssFeedService,
                s3Client,
                cdnPurgeClient,
                storage,
                tenant,
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                podcastSeriesRepository,
                subscriberFeedRepository,
                stateStore
        );
    }

    private static void enableRss(Fixture fixture) {
        when(fixture.moduleGateService.isModuleActive(10L, "PODCAST_RSS"))
                .thenReturn(true);
        when(fixture.tenantRepository.findById(10L)).thenReturn(Optional.of(fixture.tenant));
    }

    private static void stubCanonicalDomain(Fixture fixture) {
        when(fixture.tenantPublicHostResolver.resolve(
                10L,
                null,
                TenantPublicHostResolver.HostPolicy.PRIMARY
        )).thenReturn("alpha.example.test");
    }

    private record Fixture(
            RssFeedSnapshotService service,
            RssFeedService rssFeedService,
            S3Client s3Client,
            CdnPurgeClient cdnPurgeClient,
            DirectwerkProperties.Storage storage,
            Tenant tenant,
            TenantRepository tenantRepository,
            TenantPublicHostResolver tenantPublicHostResolver,
            ModuleGateService moduleGateService,
            PodcastSeriesRepository podcastSeriesRepository,
            SubscriberFeedRepository subscriberFeedRepository,
            FeedSnapshotStateStore stateStore
    ) {
    }
}
