package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.util.FeedUrls;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.newsletter.access.ArticleFeedAccess;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Article counterpart to the podcast enclosure delivery facade: stable proxy URLs in RSS
 * ({@code /feeds/.../a/...}) are resolved with entitlement checks, tracked as
 * {@code article-view} with {@code rss-click}/{@code private-rss} sources, then 302-redirected
 * to the canonical article page. Fail-open analytics: tracking never gates delivery.
 */
@Service
@RequiredArgsConstructor
public class ArticleViewDeliveryFacade {

    private final PublicArticleQueryService publicArticleQueryService;
    private final ArticleFeedAccess articleFeedAccess;
    private final ArticleViewAnalyticsService articleViewAnalyticsService;
    private final TenantPublicHostResolver tenantPublicHostResolver;

    public record TrackedArticleRedirect(Article article, String targetUrl, ResponseEntity<Void> response) {
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect publicView(
            Long tenantId,
            String articleSlug,
            String requestHost,
            String clientUserAgent
    ) {
        return publicView(tenantId, articleSlug, "https", requestHost, 443, clientUserAgent);
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect publicView(
            Long tenantId,
            String articleSlug,
            String scheme,
            String requestHost,
            int port,
            String clientUserAgent
    ) {
        return publicView(tenantId, articleSlug, scheme, requestHost, port, clientUserAgent, null);
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect publicView(
            Long tenantId,
            String articleSlug,
            String scheme,
            String requestHost,
            int port,
            String clientUserAgent,
            String clientIp
    ) {
        Article article = publicArticleQueryService.requirePublishedArticle(tenantId, articleSlug);
        if (!PublicSurfacePolicy.includesInPublicRss(article.getAccessPolicy().name())) {
            throw new ArticleNotFoundException(articleSlug);
        }
        articleViewAnalyticsService.trackArticleView(
                tenantId, article, "rss-click", requestHost, clientUserAgent, clientIp);
        return redirect(article, tenantId, scheme, requestHost, port);
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect privateView(
            ArticleFeed feed,
            String articleSlug,
            String requestHost,
            String clientUserAgent
    ) {
        return privateView(feed, articleSlug, "https", requestHost, 443, clientUserAgent);
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect privateView(
            ArticleFeed feed,
            String articleSlug,
            String scheme,
            String requestHost,
            int port,
            String clientUserAgent
    ) {
        return privateView(feed, articleSlug, scheme, requestHost, port, clientUserAgent, null);
    }

    @Transactional(readOnly = true)
    public TrackedArticleRedirect privateView(
            ArticleFeed feed,
            String articleSlug,
            String scheme,
            String requestHost,
            int port,
            String clientUserAgent,
            String clientIp
    ) {
        Long tenantId = feed.getTenant().getId();
        Article article = publicArticleQueryService.requirePublishedArticle(tenantId, articleSlug);
        if (!articleFeedAccess.hasArticleAccess(tenantId, feed.getUser().getId(), feed, article)) {
            // Never 403 — avoids feed-token oracle.
            throw new ArticleNotFoundException(articleSlug);
        }
        articleViewAnalyticsService.trackArticleView(
                tenantId, article, "private-rss", requestHost, clientUserAgent, clientIp);
        return redirect(article, tenantId, scheme, requestHost, port);
    }

    @Transactional(readOnly = true)
    public String publicArticleViewUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String articleSlug
    ) {
        String host = tenantPublicHostResolver.resolve(
                tenantId,
                requestedHostname,
                TenantPublicHostResolver.HostPolicy.TRUST_REQUEST
        );
        return FeedUrls.publicArticleView(
                PublicUrlBuilder.baseUrl(scheme, host, port),
                tenantSlug,
                articleSlug
        );
    }

    @Transactional(readOnly = true)
    public String privateArticleViewUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String feedToken,
            String articleSlug
    ) {
        String host = tenantPublicHostResolver.resolve(
                tenantId,
                requestedHostname,
                TenantPublicHostResolver.HostPolicy.TRUST_REQUEST
        );
        return FeedUrls.privateArticleView(
                PublicUrlBuilder.baseUrl(scheme, host, port),
                tenantSlug,
                feedToken,
                articleSlug
        );
    }

    private TrackedArticleRedirect redirect(
            Article article, Long tenantId, String scheme, String requestHost, int port) {
        String host;
        try {
            host = tenantPublicHostResolver.resolve(
                    tenantId, requestHost, TenantPublicHostResolver.HostPolicy.TRUST_REQUEST);
        } catch (RuntimeException ex) {
            host = requestHost;
        }
        String target = PublicUrlBuilder.baseUrl(scheme, host, port) + "/articles/" + article.getSlug();
        ResponseEntity<Void> response = ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(target))
                .cacheControl(CacheControl.noStore())
                .build();
        return new TrackedArticleRedirect(article, target, response);
    }
}
