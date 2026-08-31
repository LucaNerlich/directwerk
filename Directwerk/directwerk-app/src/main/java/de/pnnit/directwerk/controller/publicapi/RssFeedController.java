package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.digital.storage.FeedRedirects;
import de.pnnit.directwerk.modules.podcast.service.RssFeedDeliveryFacade;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/feeds/{tenantSlug}")
public class RssFeedController {

    private final TenantResolver tenantResolver;
    private final SubscriberFeedService subscriberFeedService;
    private final RssFeedSnapshotService rssFeedSnapshotService;
    private final RssFeedDeliveryFacade rssFeedDeliveryFacade;

    public RssFeedController(
            TenantResolver tenantResolver,
            SubscriberFeedService subscriberFeedService,
            RssFeedSnapshotService rssFeedSnapshotService,
            RssFeedDeliveryFacade rssFeedDeliveryFacade
    ) {
        this.tenantResolver = tenantResolver;
        this.subscriberFeedService = subscriberFeedService;
        this.rssFeedSnapshotService = rssFeedSnapshotService;
        this.rssFeedDeliveryFacade = rssFeedDeliveryFacade;
    }

    @GetMapping("/podcast.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicPodcastFeed(@PathVariable String tenantSlug) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        var delivery = rssFeedSnapshotService.publicTenantFeed(tenant);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/{seriesSlug}.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicSeriesFeed(
            @PathVariable String tenantSlug,
            @PathVariable String seriesSlug
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        var delivery = rssFeedSnapshotService.publicSeriesFeed(tenant, seriesSlug);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/u/{feedToken}.xml")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<String> privateSubscriberFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        var delivery = rssFeedSnapshotService.privateFeed(tenant, feed);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    @GetMapping("/e/{episodeSlug}.mp3")
    @RequiresModule({PodcastModule.KEY, PodcastRssModule.KEY})
    ResponseEntity<Void> publicEnclosure(
            @PathVariable String tenantSlug,
            @PathVariable String episodeSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        return rssFeedDeliveryFacade.publicEnclosure(
                tenant,
                episodeSlug,
                "public-rss",
                request.getServerName()
        ).response();
    }

    @GetMapping("/u/{feedToken}/e/{episodeSlug}.mp3")
    @RequiresModule({PodcastModule.KEY, PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Void> privateEnclosure(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            @PathVariable String episodeSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        return rssFeedDeliveryFacade.privateEnclosure(
                tenant,
                feedToken,
                episodeSlug,
                "private-rss",
                request.getServerName()
        ).response();
    }
}
