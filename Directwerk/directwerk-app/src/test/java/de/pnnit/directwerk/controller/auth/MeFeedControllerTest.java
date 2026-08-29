package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.FeedEnabledRequest;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.auth.MeFeedController.SubscriberFeedView;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver.HostPolicy;
import de.pnnit.directwerk.modules.core.util.FeedUrlResolver;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
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
    private TenantPublicHostResolver tenantPublicHostResolver;

    @Mock
    private HttpServletRequest request;

    private MeFeedController controller;

    @BeforeEach
    void setUp() {
        controller = new MeFeedController(
                subscriberFeedService,
                new FeedUrlResolver(tenantPublicHostResolver)
        );
    }

    @Test
    void listFeedsUsesVerifiedHostPolicyInsteadOfRawRequestHost() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "tok-123");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alias.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(tenantPublicHostResolver.resolve(5L, "alias.example.test", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");
        when(subscriberFeedService.listFeeds(5L, 1L)).thenReturn(List.of(feed));

        ResponseEntity<Response<List<SubscriberFeedView>>> response = controller.listFeeds(principal, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        SubscriberFeedView view = response.getBody().data().get(0);
        assertThat(view.url()).isEqualTo("https://alpha.example.test/feeds/alpha/u/tok-123.xml");
        assertThat(view.formatIds()).isEmpty();
        assertThat(view.formats()).isEmpty();
        verify(subscriberFeedService, never()).ensureDefaultFeed(5L, 1L);
    }

    @Test
    void listFeedsUsesHttpAndNonDefaultPortForLocalDev() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha-show-a", "tok-local");
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("alpha-a.localhost");
        when(request.getServerPort()).thenReturn(8080);
        when(tenantPublicHostResolver.resolve(5L, "alpha-a.localhost", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha-a.localhost");
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
        when(tenantPublicHostResolver.resolve(5L, "alpha.example.test", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");
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
        when(tenantPublicHostResolver.resolve(5L, "alpha.example.test", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");
        when(subscriberFeedService.setDefaultFeedEnabled(5L, 1L, false)).thenReturn(feed);

        ResponseEntity<Response<SubscriberFeedView>> response =
                controller.setDefaultFeedEnabled(principal, new FeedEnabledRequest(false), request);

        assertThat(response.getBody().data().enabled()).isFalse();
        verify(subscriberFeedService).setDefaultFeedEnabled(5L, 1L, false);
    }

    @Test
    void createCustomFeedRequiresFeedBuilderAndReturnsFormats() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "tok-custom");
        feed.setDefaultFeed(false);
        feed.setTitle("Nur Bonus");
        feed.getFormats().add(format(3L, "bonus", "Bonus"));
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(tenantPublicHostResolver.resolve(5L, "alpha.example.test", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");
        when(subscriberFeedService.createCustomFeed(5L, 1L, "Nur Bonus", List.of(3L))).thenReturn(feed);

        ResponseEntity<Response<SubscriberFeedView>> response = controller.createCustomFeed(
                principal,
                new MeFeedController.CreateCustomFeedRequest("Nur Bonus", List.of(3L)),
                request
        );

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().data().isDefault()).isFalse();
        assertThat(response.getBody().data().formatIds()).containsExactly(3L);
        assertThat(response.getBody().data().formats())
                .extracting(FormatView::name)
                .containsExactly("Bonus");
    }

    @Test
    void deleteCustomFeedDoesNotRequireFeedBuilder() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        SubscriberFeed feed = feed("alpha", "tok-custom");
        feed.setDefaultFeed(false);
        feed.setTitle("Nur Bonus");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(request.getServerPort()).thenReturn(443);
        when(tenantPublicHostResolver.resolve(5L, "alpha.example.test", HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");
        when(subscriberFeedService.deleteCustomFeed(5L, 1L, 12L)).thenReturn(feed);

        ResponseEntity<Response<SubscriberFeedView>> response = controller.deleteCustomFeed(principal, 12L, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().data().title()).isEqualTo("Nur Bonus");
        verify(subscriberFeedService).deleteCustomFeed(5L, 1L, 12L);
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

    private static Format format(Long id, String slug, String name) {
        Format format = new Format();
        format.setId(id);
        format.setSlug(slug);
        format.setName(name);
        format.setSortOrder(1);
        format.setActive(true);
        return format;
    }
}
