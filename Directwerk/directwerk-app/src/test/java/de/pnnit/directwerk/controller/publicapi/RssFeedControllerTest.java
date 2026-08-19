package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class RssFeedControllerTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private PodcastSeriesRepository podcastSeriesRepository;

    @Mock
    private SubscriberFeedService subscriberFeedService;

    @Mock
    private RssFeedSnapshotService rssFeedSnapshotService;

    @Mock
    private EpisodeEnclosureService episodeEnclosureService;

    @Mock
    private EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private HttpServletRequest request;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void publicFeedReturnsRssWhenModuleEnabled() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(rssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(new RssFeedSnapshotService.FeedDelivery(url("https://cdn.example.test/podcast.xml")));

        ResponseEntity<String> response = controller().publicPodcastFeed("alpha");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).hasToString("https://cdn.example.test/podcast.xml");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(moduleGateService).requireModule(PodcastRssModule.KEY);
    }

    @Test
    void publicFeedReturnsNotFoundWhenSnapshotIsNotReady() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(rssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(RssFeedSnapshotService.FeedDelivery.notReady());

        ResponseEntity<String> response = controller().publicPodcastFeed("alpha");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getHeaders().getLocation()).isNull();
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void publicPodcastFeedDelegatesToS3SnapshotService() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(rssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(new RssFeedSnapshotService.FeedDelivery(url("https://cdn.example.test/podcast.xml")));

        controller().publicPodcastFeed("alpha");

        verify(rssFeedSnapshotService).publicTenantFeed(tenant);
    }

    @Test
    void publicSeriesFeedRedirectsToS3Snapshot() {
        Tenant tenant = tenant(10L, "alpha");
        PodcastSeries series = new PodcastSeries();
        series.setId(20L);
        series.setSlug("main-show");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(podcastSeriesRepository.findByTenantIdAndSlug(10L, "main-show")).thenReturn(Optional.of(series));
        when(rssFeedSnapshotService.publicSeriesFeed(tenant, series))
                .thenReturn(new RssFeedSnapshotService.FeedDelivery(url("https://cdn.example.test/series.xml")));

        ResponseEntity<String> response = controller().publicSeriesFeed("alpha", "main-show");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(rssFeedSnapshotService).publicSeriesFeed(tenant, series);
    }

    @Test
    void publicSeriesFeedThrowsSeriesNotFoundWhenSlugUnknown() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(podcastSeriesRepository.findByTenantIdAndSlug(10L, "missing-show")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller().publicSeriesFeed("alpha", "missing-show"))
                .isInstanceOf(de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException.class);
    }

    @Test
    void privateSubscriberFeedRedirectsToSignedS3Snapshot() {
        Tenant tenant = tenant(10L, "alpha");
        SubscriberFeed feed = subscriberFeed(tenant, "tok", true);
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(subscriberFeedService.requireFeedByToken("tok")).thenReturn(feed);
        when(rssFeedSnapshotService.privateFeed(tenant, feed))
                .thenReturn(new RssFeedSnapshotService.FeedDelivery(url("https://private.example.test/feed.xml")));

        ResponseEntity<String> response = controller().privateSubscriberFeed("alpha", "tok");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(rssFeedSnapshotService).privateFeed(tenant, feed);
        verify(moduleGateService).requireModule(SubscriptionModule.MODULE_KEY);
    }

    @Test
    void privateSubscriberFeedThrowsNotFoundWhenFeedDisabled() {
        Tenant tenant = tenant(10L, "alpha");
        SubscriberFeed feed = subscriberFeed(tenant, "tok", false);
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(subscriberFeedService.requireFeedByToken("tok")).thenReturn(feed);

        assertThatThrownBy(() -> controller().privateSubscriberFeed("alpha", "tok"))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void privateSubscriberFeedThrowsNotFoundWhenFeedBelongsToOtherTenant() {
        Tenant tenant = tenant(10L, "alpha");
        Tenant otherTenant = tenant(11L, "beta");
        SubscriberFeed feed = subscriberFeed(otherTenant, "tok", true);
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(subscriberFeedService.requireFeedByToken("tok")).thenReturn(feed);

        assertThatThrownBy(() -> controller().privateSubscriberFeed("alpha", "tok"))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void privateCustomFeedThrowsNotFoundWhenFeedBuilderModuleIsOff() {
        Tenant tenant = tenant(10L, "alpha");
        SubscriberFeed feed = subscriberFeed(tenant, "tok", true);
        feed.setDefaultFeed(false);
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(subscriberFeedService.requireFeedByToken("tok")).thenReturn(feed);
        lenient().doThrow(new ModuleNotEnabledException(FeedBuilderModule.KEY))
                .when(moduleGateService)
                .requireModule(FeedBuilderModule.KEY);

        assertThatThrownBy(() -> controller().privateSubscriberFeed("alpha", "tok"))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void privateEnclosureThrowsNotFoundWhenFeedBuilderModuleIsOff() {
        Tenant tenant = tenant(10L, "alpha");
        SubscriberFeed feed = subscriberFeed(tenant, "tok", true);
        feed.setDefaultFeed(false);
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        when(subscriberFeedService.requireFeedByToken("tok")).thenReturn(feed);
        lenient().doThrow(new ModuleNotEnabledException(FeedBuilderModule.KEY))
                .when(moduleGateService)
                .requireModule(FeedBuilderModule.KEY);

        assertThatThrownBy(() -> controller().privateEnclosure("alpha", "tok", "episode-slug", request))
                .isInstanceOf(SubscriberFeedNotFoundException.class);

        verify(episodeEnclosureService, org.mockito.Mockito.never()).resolvePrivateRedirect(org.mockito.Mockito.any(), org.mockito.Mockito.anyString());
        verify(episodeDownloadAnalyticsService, org.mockito.Mockito.never()).trackEpisodeDownload(org.mockito.Mockito.anyLong(), org.mockito.Mockito.any(), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString());
    }

    @Test
    void publicFeedThrowsModuleNotEnabledWhenRssModuleMissing() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));
        doThrow(new ModuleNotEnabledException(PodcastRssModule.KEY))
                .when(moduleGateService)
                .requireModule(PodcastRssModule.KEY);

        assertThatThrownBy(() -> controller().publicPodcastFeed("alpha"))
                .isInstanceOf(ModuleNotEnabledException.class)
                .isNotInstanceOf(TenantNotFoundException.class);
    }

    @Test
    void publicFeedThrowsTenantNotFoundWhenSlugDoesNotMatchHostTenant() {
        Tenant tenant = tenant(10L, "alpha");
        TenantContext.setTenantId(10L);
        when(tenantRepository.findById(10L)).thenReturn(Optional.of(tenant));

        assertThatThrownBy(() -> controller().publicPodcastFeed("other"))
                .isInstanceOf(TenantNotFoundException.class);
    }

    private RssFeedController controller() {
        return new RssFeedController(
                tenantRepository,
                podcastSeriesRepository,
                subscriberFeedService,
                rssFeedSnapshotService,
                episodeEnclosureService,
                episodeDownloadAnalyticsService,
                moduleGateService
        );
    }

    private static Tenant tenant(Long id, String slug) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug(slug);
        return tenant;
    }

    private static SubscriberFeed subscriberFeed(Tenant tenant, String feedToken, boolean enabled) {
        SubscriberFeed feed = new SubscriberFeed();
        feed.setTenant(tenant);
        feed.setFeedToken(feedToken);
        feed.setEnabled(enabled);
        return feed;
    }

    private static URL url(String value) {
        try {
            return new URL(value);
        } catch (MalformedURLException ex) {
            throw new IllegalArgumentException(ex);
        }
    }
}
