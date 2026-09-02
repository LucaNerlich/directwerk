package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import de.pnnit.directwerk.testsupport.TestObjectProviders;
import java.net.URL;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

class ArticleRssFeedSnapshotServiceTest {

    @Test
    void feedRequestRedirectsWithoutGeneratingXmlWhenSnapshotIsWritten() {
        Fixture fixture = fixture();
        when(fixture.stateStore.isWritten(10L, ArticleFeedSnapshotKind.ARTICLE_TENANT.name(), 0L)).thenReturn(true);

        var delivery = fixture.service.publicTenantFeed(fixture.tenant);

        assertThat(delivery.ready()).isTrue();
        assertThat(delivery.redirectUrl().toString())
                .isEqualTo("https://public.example.test/alpha/public/rss/articles.xml");
        verify(fixture.articleRssFeedService, never()).buildPublicFeed(any(), any(), any(), any(Integer.class));
        verify(fixture.s3Client, never()).putObject(
                any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)
        );
    }

    @Test
    void feedRequestReturnsNotReadyWhenSnapshotHasNotBeenWritten() {
        Fixture fixture = fixture();
        when(fixture.stateStore.isWritten(10L, ArticleFeedSnapshotKind.ARTICLE_TENANT.name(), 0L)).thenReturn(false);

        var delivery = fixture.service.publicTenantFeed(fixture.tenant);

        assertThat(delivery.ready()).isFalse();
        assertThat(delivery.redirectUrl()).isNull();
    }

    @Test
    void refreshJobUploadsTheCanonicalS3ObjectAndMarksItWritten() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.articleFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(fixture.articleRssFeedService.buildPublicFeed(
                fixture.tenant, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(fixture.s3Client).putObject(request.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertThat(request.getValue().key()).isEqualTo("alpha/public/rss/articles.xml");
        verify(fixture.s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(fixture.stateStore).markWritten(10L, ArticleFeedSnapshotKind.ARTICLE_TENANT.name(), 0L);
    }

    @Test
    void refreshWhenArticleRssModuleOffDeletesPublicSnapshotAndPurgesCdn() {
        Fixture fixture = fixture();
        when(fixture.tenantRepository.findById(10L)).thenReturn(Optional.of(fixture.tenant));
        when(fixture.moduleGateService.isModuleActive(10L, "ARTICLE_RSS")).thenReturn(false);
        when(fixture.articleFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of());

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/public/rss/articles.xml");
        verify(fixture.s3Client, never()).putObject(
                any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)
        );
        ArgumentCaptor<URL> purged = ArgumentCaptor.forClass(URL.class);
        verify(fixture.cdnPurgeClient).purgeUrl(purged.capture());
        assertThat(purged.getValue().toString())
                .isEqualTo("https://public.example.test/alpha/public/rss/articles.xml");
        verify(fixture.stateStore).clearWritten(10L);
    }

    @Test
    void refreshDeletesDisabledPrivateFeed() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.articleRssFeedService.buildPublicFeed(
                fixture.tenant, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");
        ArticleFeed disabled = new ArticleFeed();
        disabled.setId(42L);
        disabled.setTenant(fixture.tenant);
        disabled.setEnabled(false);
        when(fixture.articleFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of(disabled));

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/private/rss/article-feed-42.xml");
        verify(fixture.stateStore).clearWritten(10L, ArticleFeedSnapshotKind.ARTICLE_PRIVATE_FEED.name(), 42L);
    }

    @Test
    void refreshWithdrawsEnabledCustomFeedWhenFeedBuilderModuleIsOff() {
        Fixture fixture = fixture();
        enableRss(fixture);
        stubCanonicalDomain(fixture);
        when(fixture.articleRssFeedService.buildPublicFeed(
                fixture.tenant, "https", "alpha.example.test", 443
        )).thenReturn("<rss>generated</rss>");
        ArticleFeed custom = new ArticleFeed();
        custom.setId(42L);
        custom.setTenant(fixture.tenant);
        custom.setDefaultFeed(false);
        custom.setEnabled(true);
        when(fixture.articleFeedRepository.findByTenantIdOrderByIdAsc(10L)).thenReturn(List.of(custom));

        fixture.service.refreshTenant(10L);

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(fixture.s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/private/rss/article-feed-42.xml");
        verify(fixture.articleRssFeedService, never()).buildPrivateFeed(any(), any(), any(), any(), any(Integer.class));
    }

    private Fixture fixture() {
        ArticleRssFeedService articleRssFeedService = mock(ArticleRssFeedService.class);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        TenantPublicHostResolver tenantPublicHostResolver = mock(TenantPublicHostResolver.class);
        ModuleGateService moduleGateService = mock(ModuleGateService.class);
        ArticleFeedRepository articleFeedRepository = mock(ArticleFeedRepository.class);
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
        ArticleRssFeedSnapshotService service = new ArticleRssFeedSnapshotService(
                articleRssFeedService,
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                articleFeedRepository,
                stateStore,
                snapshotStore,
                directwerkConfig
        );
        return new Fixture(
                service,
                articleRssFeedService,
                s3Client,
                cdnPurgeClient,
                tenant,
                tenantRepository,
                tenantPublicHostResolver,
                moduleGateService,
                articleFeedRepository,
                stateStore
        );
    }

    private static void enableRss(Fixture fixture) {
        when(fixture.moduleGateService.isModuleActive(10L, "ARTICLE_RSS")).thenReturn(true);
        when(fixture.tenantRepository.findById(10L)).thenReturn(Optional.of(fixture.tenant));
    }

    private static void stubCanonicalDomain(Fixture fixture) {
        when(fixture.tenantPublicHostResolver.findPrimaryVerifiedHost(10L))
                .thenReturn(Optional.of("alpha.example.test"));
    }

    private record Fixture(
            ArticleRssFeedSnapshotService service,
            ArticleRssFeedService articleRssFeedService,
            S3Client s3Client,
            CdnPurgeClient cdnPurgeClient,
            Tenant tenant,
            TenantRepository tenantRepository,
            TenantPublicHostResolver tenantPublicHostResolver,
            ModuleGateService moduleGateService,
            ArticleFeedRepository articleFeedRepository,
            FeedSnapshotStateStore stateStore
    ) {
    }
}
