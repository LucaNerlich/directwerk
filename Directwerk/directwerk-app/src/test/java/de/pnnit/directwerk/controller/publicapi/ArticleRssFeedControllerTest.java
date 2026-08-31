package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.storage.GeneratedFeedSnapshotStore.FeedDelivery;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedNotFoundException;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleRssFeedSnapshotService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import java.net.MalformedURLException;
import java.net.URL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class ArticleRssFeedControllerTest {

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private ArticleFeedService articleFeedService;

    @Mock
    private ArticleRssFeedSnapshotService articleRssFeedSnapshotService;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void publicArticleFeedReturnsRssWhenSnapshotReady() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(articleRssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(new FeedDelivery(url("https://cdn.example.test/articles.xml")));

        ResponseEntity<String> response = controller().publicArticleFeed("alpha");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).hasToString("https://cdn.example.test/articles.xml");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(articleRssFeedSnapshotService).publicTenantFeed(tenant);
    }

    @Test
    void publicArticleFeedReturnsNotFoundWhenSnapshotIsNotReady() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(articleRssFeedSnapshotService.publicTenantFeed(tenant))
                .thenReturn(FeedDelivery.notReady());

        ResponseEntity<String> response = controller().publicArticleFeed("alpha");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getHeaders().getLocation()).isNull();
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void privateArticleFeedRedirectsToSignedS3Snapshot() {
        Tenant tenant = tenant(10L, "alpha");
        ArticleFeed feed = articleFeed(tenant, "tok", true);
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(articleFeedService.requireDeliverableFeed(10L, "tok")).thenReturn(feed);
        when(articleRssFeedSnapshotService.privateFeed(tenant, feed))
                .thenReturn(new FeedDelivery(url("https://private.example.test/article-feed.xml")));

        ResponseEntity<String> response = controller().privateArticleFeed("alpha", "tok");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        verify(articleRssFeedSnapshotService).privateFeed(tenant, feed);
    }

    @Test
    void privateArticleFeedPropagatesNotFoundFromDeliveryGate() {
        Tenant tenant = tenant(10L, "alpha");
        when(tenantResolver.requireHostTenantBySlug("alpha")).thenReturn(tenant);
        when(articleFeedService.requireDeliverableFeed(10L, "tok"))
                .thenThrow(new ArticleFeedNotFoundException());

        assertThatThrownBy(() -> controller().privateArticleFeed("alpha", "tok"))
                .isInstanceOf(ArticleFeedNotFoundException.class);
    }

    @Test
    void publicArticleFeedThrowsNotFoundWhenPathSlugDoesNotMatchHostTenant() {
        when(tenantResolver.requireHostTenantBySlug("other")).thenThrow(new TenantNotFoundException("other"));

        assertThatThrownBy(() -> controller().publicArticleFeed("other"))
                .isInstanceOf(TenantNotFoundException.class);
    }

    private ArticleRssFeedController controller() {
        return new ArticleRssFeedController(
                tenantResolver,
                articleFeedService,
                articleRssFeedSnapshotService
        );
    }

    private static Tenant tenant(Long id, String slug) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug(slug);
        return tenant;
    }

    private static ArticleFeed articleFeed(Tenant tenant, String feedToken, boolean enabled) {
        ArticleFeed feed = new ArticleFeed();
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
