package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedNotFoundException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleRssFeedService {

    private final PublicArticleQueryService publicArticleQueryService;
    private final ArticleFeedAccess articleFeedAccess;
    private final ArticleRssXmlBuilder articleRssXmlBuilder;
    private final ArticleViewDeliveryFacade articleViewDeliveryFacade;
    private final FeedTokenProtector feedTokenProtector;

    /**
     * Builds a public RSS feed containing every free published article for a tenant.
     * Item links use the stable tracked view proxy (Umami click-through), never direct pages.
     */
    @Transactional(readOnly = true)
    public String buildPublicFeed(Tenant tenant, String scheme, String host, int port) {
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<Article> articles = publicArticleQueryService.listPublishedArticles(tenant.getId()).stream()
                .filter(article -> PublicSurfacePolicy.includesInPublicRss(article.getAccessPolicy().name()))
                .toList();
        return articleRssXmlBuilder.buildFeed(
                tenant,
                articles,
                originBaseUrl,
                null,
                article -> articleViewDeliveryFacade.publicArticleViewUrl(
                        tenant.getId(), scheme, host, port, tenant.getSlug(), article.getSlug())
        );
    }

    /**
     * Builds a private RSS feed containing every article the feed owner is entitled to.
     * FREE articles reuse the public proxy; entitled PAID articles use the token proxy.
     *
     * @throws ArticleFeedNotFoundException if the article feed is disabled
     */
    @Transactional(readOnly = true)
    public String buildPrivateFeed(Tenant tenant, ArticleFeed feed, String scheme, String host, int port) {
        if (!feed.isEnabled()) {
            throw new ArticleFeedNotFoundException();
        }
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<Article> articles = articleFeedAccess.listEntitledArticles(tenant.getId(), feed.getUser().getId(), feed);
        return articleRssXmlBuilder.buildFeed(
                tenant,
                articles,
                originBaseUrl,
                feed.getTitle(),
                article -> {
                    if (PublicSurfacePolicy.includesInPublicRss(article.getAccessPolicy().name())) {
                        return articleViewDeliveryFacade.publicArticleViewUrl(
                                tenant.getId(), scheme, host, port, tenant.getSlug(), article.getSlug());
                    }
                    return articleViewDeliveryFacade.privateArticleViewUrl(
                            tenant.getId(),
                            scheme,
                            host,
                            port,
                            tenant.getSlug(),
                            feedTokenProtector.reveal(feed.getFeedToken()),
                            article.getSlug());
                }
        );
    }
}
