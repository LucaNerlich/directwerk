package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedDeliveryFacade;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.net.MalformedURLException;
import java.net.URL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Controller-level behaviour only: host-tenant matching, delivery delegation and redirect
 * shaping. Module gating is annotation-driven (covered by {@code RequiresModuleAspectTest});
 * token/tenant/enabled/feed-builder policy lives in {@code SubscriberFeedService}.
 */
@ExtendWith(MockitoExtension.class)
class RssFeedControllerTest {

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private SubscriberFeedService subscriberFeedService;

    @Mock
    private RssFeedSnapshotService rssFeedSnapshotService;

    @Mock
    private RssFeedDeliveryFacade rssFeedDeliveryFacade;

    @Mock
    private de.pnnit.directwerk.modules.core.analytics.FeedFetchAnalyticsService feedFetchAnalyticsService;

    @Mock
    private HttpServletRequest request;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void publicFeedReturnsRssWhenSnapshotReady() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(rssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(new de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery(url("https://cdn.example.test/podcast.xml")));

        ResponseEntity<String> response = controller().publicPodcastFeed("alpha", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).hasToString("https://cdn.example.test/podcast.xml");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(rssFeedSnapshotService).publicTenantFeed(tenant);
    }

    @Test
    void publicFeedReturnsNotFoundWhenSnapshotIsNotReady() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(rssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery.notReady());

        ResponseEntity<String> response = controller().publicPodcastFeed("alpha", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getHeaders().getLocation()).isNull();
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void publicSeriesFeedResolvesBySlugAndRedirectsToS3Snapshot() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(rssFeedSnapshotService.publicSeriesFeed(tenant, "main-show"))
                .thenReturn(new de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery(url("https://cdn.example.test/series.xml")));

        ResponseEntity<String> response = controller().publicSeriesFeed("alpha", "main-show", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(rssFeedSnapshotService).publicSeriesFeed(tenant, "main-show");
    }

    @Test
    void publicSeriesFeedThrowsSeriesNotFoundWhenSlugUnknown() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(rssFeedSnapshotService.publicSeriesFeed(tenant, "missing-show"))
                .thenThrow(new de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException("missing-show"));

        assertThatThrownBy(() -> controller().publicSeriesFeed("alpha", "missing-show", request))
                .isInstanceOf(de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException.class);
    }

    @Test
    void privateSubscriberFeedRedirectsToSignedS3Snapshot() {
        Tenant tenant = tenant(10L, "alpha");
        SubscriberFeed feed = subscriberFeed(tenant, "tok", true);
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(subscriberFeedService.requireDeliverableFeed(10L, "tok")).thenReturn(feed);
        when(rssFeedSnapshotService.privateFeed(tenant, feed))
                .thenReturn(new de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery(url("https://private.example.test/feed.xml")));

        ResponseEntity<String> response = controller().privateSubscriberFeed("alpha", "tok", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(rssFeedSnapshotService).privateFeed(tenant, feed);
    }

    @Test
    void privateSubscriberFeedPropagatesNotFoundFromDeliveryGate() {
        Tenant tenant = tenant(10L, "alpha");
        // Disabled feeds, foreign-tenant tokens and custom feeds without FEED_BUILDER all
        // surface as not-found — decided inside SubscriberFeedService.requireDeliverableFeed.
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(subscriberFeedService.requireDeliverableFeed(10L, "tok"))
                .thenThrow(new SubscriberFeedNotFoundException());

        assertThatThrownBy(() -> controller().privateSubscriberFeed("alpha", "tok", request))
                .isInstanceOf(SubscriberFeedNotFoundException.class);
    }

    @Test
    void publicFeedThrowsNotFoundWhenPathSlugDoesNotMatchHostTenant() {
        when(tenantResolver.requireHostTenantBySlug("other")).thenThrow(new TenantNotFoundException("other"));

        assertThatThrownBy(() -> controller().publicPodcastFeed("other", request))
                .isInstanceOf(TenantNotFoundException.class);
    }

    private RssFeedController controller() {
        return new RssFeedController(
                tenantResolver,
                subscriberFeedService,
                rssFeedSnapshotService,
                rssFeedDeliveryFacade,
                feedFetchAnalyticsService
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
            return java.net.URI.create(value).toURL();
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException(e);
        }
    }
}
