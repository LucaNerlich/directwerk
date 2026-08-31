package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.storage.FeedRedirects;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleRssFeedSnapshotService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import org.springframework.http.ResponseEntity;
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

    public ArticleRssFeedController(
            TenantResolver tenantResolver,
            ArticleFeedService articleFeedService,
            ArticleRssFeedSnapshotService articleRssFeedSnapshotService
    ) {
        this.tenantResolver = tenantResolver;
        this.articleFeedService = articleFeedService;
        this.articleRssFeedSnapshotService = articleRssFeedSnapshotService;
    }

    @GetMapping("/articles.xml")
    @RequiresModule(ArticleRssModule.KEY)
    ResponseEntity<String> publicArticleFeed(@PathVariable String tenantSlug) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        var delivery = articleRssFeedSnapshotService.publicTenantFeed(tenant);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/articles/u/{feedToken}.xml")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<String> privateArticleFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        ArticleFeed feed = articleFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        var delivery = articleRssFeedSnapshotService.privateFeed(tenant, feed);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }
}
