package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.controller.RequestClientIpExtractor;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.analytics.FeedFetchAnalyticsService;
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
    private final FeedFetchAnalyticsService feedFetchAnalyticsService;

    public RssFeedController(
            TenantResolver tenantResolver,
            SubscriberFeedService subscriberFeedService,
            RssFeedSnapshotService rssFeedSnapshotService,
            RssFeedDeliveryFacade rssFeedDeliveryFacade,
            FeedFetchAnalyticsService feedFetchAnalyticsService
    ) {
        this.tenantResolver = tenantResolver;
        this.subscriberFeedService = subscriberFeedService;
        this.rssFeedSnapshotService = rssFeedSnapshotService;
        this.rssFeedDeliveryFacade = rssFeedDeliveryFacade;
        this.feedFetchAnalyticsService = feedFetchAnalyticsService;
    }

    /**
     * Provides the public podcast RSS feed for a tenant.
     *
     * @param tenantSlug the tenant's URL slug
     * @return a response redirecting to the tenant's public RSS feed
     */
    @GetMapping("/podcast.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicPodcastFeed(
            @PathVariable String tenantSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        feedFetchAnalyticsService.trackFeedFetch(
                tenant.getId(),
                "podcast",
                "public",
                request.getServerName(),
                request.getHeader("User-Agent"),
                RequestClientIpExtractor.extract(request));
        var delivery = rssFeedSnapshotService.publicTenantFeed(tenant);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    /**
     * Provides the public RSS feed for a podcast series within a tenant.
     *
     * @param tenantSlug the tenant identifier in the request path
     * @param seriesSlug the podcast series identifier in the request path
     * @param request    the HTTP request containing client metadata
     * @return a redirect response for the series RSS feed
     */
    @GetMapping("/{seriesSlug}.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicSeriesFeed(
            @PathVariable String tenantSlug,
            @PathVariable String seriesSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        feedFetchAnalyticsService.trackFeedFetch(
                tenant.getId(),
                "podcast",
                "public",
                request.getServerName(),
                request.getHeader("User-Agent"),
                RequestClientIpExtractor.extract(request));
        var delivery = rssFeedSnapshotService.publicSeriesFeed(tenant, seriesSlug);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    /**
     * Delivers a tenant's private subscriber RSS feed.
     *
     * @param tenantSlug the tenant's URL slug
     * @param feedToken  the subscriber feed access token
     * @return an RSS redirect response for the private feed
     */
    @GetMapping("/u/{feedToken}.xml")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<String> privateSubscriberFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);
        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        feedFetchAnalyticsService.trackFeedFetch(
                tenant.getId(),
                "podcast",
                "private",
                request.getServerName(),
                request.getHeader("User-Agent"),
                RequestClientIpExtractor.extract(request));
        var delivery = rssFeedSnapshotService.privateFeed(tenant, feed);
        return FeedRedirects.rssRedirect(delivery.redirectUrl(), delivery.ready());
    }

    /**
     * Delivers a public podcast episode enclosure.
     *
     * @param tenantSlug  the tenant identifier
     * @param episodeSlug the episode identifier
     * @return the enclosure delivery response
     */
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
                request.getServerName(),
                request.getHeader("User-Agent"),
                request.getHeader("Range") != null,
                RequestClientIpExtractor.extract(request)
        ).response();
    }

    /**
     * Delivers a private podcast episode enclosure for a subscriber feed.
     *
     * @param feedToken   the subscriber feed token
     * @param episodeSlug the episode identifier
     * @return the HTTP response for the episode enclosure
     */
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
                request.getServerName(),
                request.getHeader("User-Agent"),
                request.getHeader("Range") != null,
                RequestClientIpExtractor.extract(request)
        ).response();
    }
}
