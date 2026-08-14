package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.auth.MeFeedController.SubscriberFeedView;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MeFeedControllerTest {

    @Mock
    private SubscriberFeedService subscriberFeedService;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private HttpServletRequest request;

    private MeFeedController controller;

    @BeforeEach
    void setUp() {
        controller = new MeFeedController(subscriberFeedService, moduleGateService);
    }

    @Test
    void listFeedsBuildsFeedUrlFromRequestSchemeAndPort() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "tok-123");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(subscriberFeedService.listFeeds(5L, 1L)).thenReturn(List.of(feed));

        ResponseEntity<Response<List<SubscriberFeedView>>> response = controller.listFeeds(principal, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        SubscriberFeedView view = response.getBody().data().get(0);
        assertThat(view.url()).isEqualTo("https://alpha.example.test/feeds/alpha/u/tok-123.xml");
        verify(subscriberFeedService).ensureDefaultFeed(5L, 1L);
        verify(moduleGateService).requireModule(PodcastRssModule.KEY);
        verify(moduleGateService).requireModule(SubscriptionModule.MODULE_KEY);
    }

    @Test
    void listFeedsUsesHttpAndNonDefaultPortForLocalDev() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha-show-a", "tok-local");
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("alpha-a.localhost");
        when(request.getServerPort()).thenReturn(8080);
        when(subscriberFeedService.listFeeds(5L, 1L)).thenReturn(List.of(feed));

        ResponseEntity<Response<List<SubscriberFeedView>>> response = controller.listFeeds(principal, request);

        assertThat(response.getBody().data().get(0).url())
                .isEqualTo("http://alpha-a.localhost:8080/feeds/alpha-show-a/u/tok-local.xml");
    }

    @Test
    void listFeedsReturnsEmptyListWhenUserHasNoFeeds() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        when(subscriberFeedService.listFeeds(5L, 1L)).thenReturn(List.of());

        ResponseEntity<Response<List<SubscriberFeedView>>> response = controller.listFeeds(principal, request);

        assertThat(response.getBody().data()).isEmpty();
    }

    @Test
    void rotateDefaultTokenReturnsFeedViewWithUpdatedUrl() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "new-token");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(subscriberFeedService.rotateDefaultFeedToken(5L, 1L)).thenReturn(feed);

        ResponseEntity<Response<SubscriberFeedView>> response = controller.rotateDefaultToken(principal, request);

        assertThat(response.getBody().data().url())
                .isEqualTo("https://alpha.example.test/feeds/alpha/u/new-token.xml");
    }

    @Test
    void setDefaultFeedEnabledDelegatesToServiceWithRequestedValue() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "tok-123");
        feed.setEnabled(false);
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(subscriberFeedService.setDefaultFeedEnabled(5L, 1L, false)).thenReturn(feed);

        ResponseEntity<Response<SubscriberFeedView>> response =
                controller.setDefaultFeedEnabled(principal, new MeFeedController.FeedEnabledRequest(false), request);

        assertThat(response.getBody().data().enabled()).isFalse();
        verify(subscriberFeedService).setDefaultFeedEnabled(5L, 1L, false);
    }

    private static DirectwerkUserPrincipal principal(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "user-" + userId + "@example.test",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }

    private static SubscriberFeed feed(String tenantSlug, String feedToken) {
        Tenant tenant = new Tenant();
        tenant.setId(5L);
        tenant.setSlug(tenantSlug);

        SubscriberFeed feed = new SubscriberFeed();
        feed.setId(1L);
        feed.setTenant(tenant);
        feed.setFeedToken(feedToken);
        feed.setTitle("Default Feed");
        feed.setDefaultFeed(true);
        feed.setEnabled(true);
        feed.setCreatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        feed.setUpdatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        return feed;
    }
}
