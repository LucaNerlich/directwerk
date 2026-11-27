package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleRssFeedServiceTest {

    @Mock
    private PublicArticleQueryService publicArticleQueryService;

    @Mock
    private ArticleFeedAccess articleFeedAccess;

    @Mock
    private ArticleRssXmlBuilder articleRssXmlBuilder;

    @Mock
    private FeedTokenProtector feedTokenProtector;

    @InjectMocks
    private ArticleRssFeedService service;

    @Test
    void publicFeedLinksTheTrackedViewProxy() {
        Tenant tenant = tenant();
        Article article = article("hello");
        when(publicArticleQueryService.listPublishedArticles(10L)).thenReturn(List.of(article));
        ArgumentCaptor<Function<Article, String>> links = linkCaptor();
        when(articleRssXmlBuilder.buildFeed(any(), any(), any(), any(), links.capture()))
                .thenReturn("<rss/>");

        service.buildPublicFeed(tenant, "https", "alpha.example.test", 443);

        assertThat(links.getValue().apply(article))
                .isEqualTo("https://alpha.example.test/feeds/alpha/a/hello");
    }

    @Test
    void privateFeedUsesThePublicProxyForFreeAndTheTokenProxyForPaid() {
        Tenant tenant = tenant();
        ArticleFeed feed = new ArticleFeed();
        feed.setEnabled(true);
        feed.setFeedToken("enc-feed-token");
        User user = new User();
        user.setId(5L);
        feed.setUser(user);
        Article free = article("free-one");
        Article paid = article("paid-one");
        paid.setAccessPolicy(AccessPolicy.PAID);
        when(articleFeedAccess.listEntitledArticles(10L, 5L, feed)).thenReturn(List.of(free, paid));
        when(feedTokenProtector.reveal("enc-feed-token")).thenReturn("tok");
        ArgumentCaptor<Function<Article, String>> links = linkCaptor();
        when(articleRssXmlBuilder.buildFeed(any(), any(), any(), any(), links.capture()))
                .thenReturn("<rss/>");

        service.buildPrivateFeed(tenant, feed, "https", "alpha.example.test", 443);

        assertThat(links.getValue().apply(free))
                .isEqualTo("https://alpha.example.test/feeds/alpha/a/free-one");
        assertThat(links.getValue().apply(paid))
                .isEqualTo("https://alpha.example.test/feeds/alpha/articles/u/tok/a/paid-one");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static ArgumentCaptor<Function<Article, String>> linkCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(Function.class);
    }

    private static Article article(String slug) {
        Article article = new Article();
        article.setSlug(slug);
        article.setAccessPolicy(AccessPolicy.FREE);
        return article;
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        tenant.setName("Alpha");
        return tenant;
    }
}
