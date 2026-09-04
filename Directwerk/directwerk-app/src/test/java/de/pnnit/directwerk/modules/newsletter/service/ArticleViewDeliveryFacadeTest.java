package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class ArticleViewDeliveryFacadeTest {

    @Mock
    private PublicArticleQueryService publicArticleQueryService;

    @Mock
    private ArticleFeedAccess articleFeedAccess;

    @Mock
    private ArticleViewAnalyticsService articleViewAnalyticsService;

    @Mock
    private TenantPublicHostResolver tenantPublicHostResolver;

    @Test
    void publicViewTracksClickAndRedirectsNoStore() {
        Article article = article(10L, "hello-world", AccessPolicy.FREE);
        when(publicArticleQueryService.requirePublishedArticle(10L, "hello-world")).thenReturn(article);
        when(tenantPublicHostResolver.resolve(10L, "alpha.example.test", TenantPublicHostResolver.HostPolicy.TRUST_REQUEST))
                .thenReturn("alpha.example.test");

        var tracked = facade().publicView(10L, "hello-world", "alpha.example.test", "Reader/1.0");

        assertThat(tracked.response().getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(tracked.response().getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(tracked.targetUrl()).isEqualTo("https://alpha.example.test/articles/hello-world");
        verify(articleViewAnalyticsService)
                .trackArticleView(10L, article, "rss-click", "alpha.example.test", "Reader/1.0", null);
    }

    @Test
    void publicViewRejectsPaidArticle() {
        Article article = article(10L, "paid-post", AccessPolicy.PAID);
        when(publicArticleQueryService.requirePublishedArticle(10L, "paid-post")).thenReturn(article);

        assertThatThrownBy(() -> facade().publicView(10L, "paid-post", "alpha.example.test", null))
                .isInstanceOf(ArticleNotFoundException.class);
    }

    @Test
    void privateViewChecksEntitlement() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        User user = new User();
        user.setId(20L);
        ArticleFeed feed = new ArticleFeed();
        feed.setTenant(tenant);
        feed.setUser(user);
        feed.setFeedToken("tok");
        Article article = article(10L, "paid-post", AccessPolicy.PAID);
        when(publicArticleQueryService.requirePublishedArticle(10L, "paid-post")).thenReturn(article);
        when(articleFeedAccess.hasArticleAccess(10L, 20L, feed, article)).thenReturn(false);

        assertThatThrownBy(() -> facade().privateView(feed, "paid-post", "alpha.example.test", null))
                .isInstanceOf(ArticleNotFoundException.class);
    }

    private ArticleViewDeliveryFacade facade() {
        return new ArticleViewDeliveryFacade(
                publicArticleQueryService,
                articleFeedAccess,
                articleViewAnalyticsService,
                tenantPublicHostResolver
        );
    }

    private static Article article(Long tenantId, String slug, AccessPolicy policy) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setSlug("alpha");
        Article article = new Article();
        article.setId(30L);
        article.setTenant(tenant);
        article.setSlug(slug);
        article.setTitle(slug);
        article.setStatus(ArticleStatus.PUBLISHED);
        article.setAccessPolicy(policy);
        return article;
    }
}
