package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.analytics.FeedFetchAnalyticsService;
import de.pnnit.directwerk.modules.core.util.ClientIpExtractor;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.storage.FeedRedirects;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleRssFeedSnapshotService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleViewDeliveryFacade;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/feeds/{tenantSlug}")
public class ArticleRssFeedController {

    private final TenantResolver tenantResolver;
    private final ArticleFeedService articleFeedService;
    private final ArticleRssFeedSnapshotService articleRssFeedSnapshotService;
    private final ArticleViewDeliveryFacade articleViewDeliveryFacade;
    private final FeedFetchAnalyticsService feedFetchAnalyticsService;
    private final Set<String> trustedProxies;

    public ArticleRssFeedController(
            TenantResolver tenantResolver,
            ArticleFeedService articleFeedService,
            ArticleRssFeedSnapshotService articleRssFeedSnapshotService,
            ArticleViewDeliveryFacade articleViewDeliveryFacade,
            FeedFetchAnalyticsService feedFetchAnalyticsService,
            DirectwerkConfig directwerkConfig
    ) {
        this.tenantResolver = tenantResolver;
        this.articleFeedService = articleFeedService;
        this.articleRssFeedSnapshotService = articleRssFeedSnapshotService;
        this.articleViewDeliveryFacade = articleViewDeliveryFacade;
        this.feedFetchAnalyticsService = feedFetchAnalyticsService;
        this.trustedProxies = directwerkConfig.security().trustedProxies().stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.toUnmodifiableSet());
    }

    @GetMapping("/articles.xml")
    @RequiresModule(ArticleRssModule.KEY)
    ResponseEntity<String> publicArticleFeed(
            @PathVariable String tenantSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        feedFetchAnalyticsService.trackFeedFetch(
                tenant.getId(),
                "article",
                "public",
                request.getServerName(),
                request.getHeader("User-Agent"),
                clientIp(request));
        var delivery = articleRssFeedSnapshotService.publicTenantFeed(tenant);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/articles/u/{feedToken}.xml")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<String> privateArticleFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        ArticleFeed feed = articleFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        feedFetchAnalyticsService.trackFeedFetch(
                tenant.getId(),
                "article",
                "private",
                request.getServerName(),
                request.getHeader("User-Agent"),
                clientIp(request));
        var delivery = articleRssFeedSnapshotService.privateFeed(tenant, feed);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/a/{articleSlug}")
    @RequiresModule({DigitalContentModule.KEY, ArticleRssModule.KEY})
    ResponseEntity<Void> publicArticleView(
            @PathVariable String tenantSlug,
            @PathVariable String articleSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        return articleViewDeliveryFacade.publicView(
                tenant.getId(),
                articleSlug,
                request.getScheme(),
                request.getServerName(),
                request.getServerPort(),
                request.getHeader("User-Agent"),
                clientIp(request)
        ).response();
    }

    @GetMapping("/articles/u/{feedToken}/a/{articleSlug}")
    @RequiresModule({DigitalContentModule.KEY, ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Void> privateArticleView(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            @PathVariable String articleSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        ArticleFeed feed = articleFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        return articleViewDeliveryFacade.privateView(
                feed,
                articleSlug,
                request.getScheme(),
                request.getServerName(),
                request.getServerPort(),
                request.getHeader("User-Agent"),
                clientIp(request)
        ).response();
    }

    private String clientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || !trustedProxies.contains(remoteAddr)) {
            return ClientIpExtractor.extract(null, null, remoteAddr);
        }
        return ClientIpExtractor.extract(request);
    }
}
