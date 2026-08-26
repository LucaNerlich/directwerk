package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
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
    private final EpisodeEnclosureService episodeEnclosureService;
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    public RssFeedController(
            TenantResolver tenantResolver,
            SubscriberFeedService subscriberFeedService,
            RssFeedSnapshotService rssFeedSnapshotService,
            EpisodeEnclosureService episodeEnclosureService,
            EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService
    ) {
        this.tenantResolver = tenantResolver;
        this.subscriberFeedService = subscriberFeedService;
        this.rssFeedSnapshotService = rssFeedSnapshotService;
        this.episodeEnclosureService = episodeEnclosureService;
        this.episodeDownloadAnalyticsService = episodeDownloadAnalyticsService;
    }

    /**
     * Resolves the public podcast RSS feed for a tenant to its public pull-zone object.
     *
     * @param tenantSlug the tenant's URL slug
     * @return the public podcast RSS feed response
     */
    @GetMapping("/podcast.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicPodcastFeed(@PathVariable String tenantSlug) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);

        var delivery = rssFeedSnapshotService.publicTenantFeed(tenant);
        return rssResponse(delivery);
    }

    /**
     * Resolves the public RSS feed for a podcast series to its public pull-zone object.
     *
     * @param tenantSlug the tenant slug
     * @param seriesSlug the podcast series slug
     * @return           the generated RSS XML response
     */
    @GetMapping("/{seriesSlug}.xml")
    @RequiresModule(PodcastRssModule.KEY)
    ResponseEntity<String> publicSeriesFeed(
            @PathVariable String tenantSlug,
            @PathVariable String seriesSlug
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);

        var delivery = rssFeedSnapshotService.publicSeriesFeed(tenant, seriesSlug);
        return rssResponse(delivery);
    }

    /**
     * Resolves the private RSS feed for an enabled subscriber to its signed pull-zone object.
     *
     * @param tenantSlug the tenant slug
     * @param feedToken  the subscriber feed token
     * @return the RSS XML response
     */
    @GetMapping("/u/{feedToken}.xml")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<String> privateSubscriberFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);

        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        var delivery = rssFeedSnapshotService.privateFeed(tenant, feed);
        return rssResponse(delivery);
    }

    /**
     * Stable public enclosure proxy — no auth. Tracks Umami then 302 to CDN.
     */
    @GetMapping("/e/{episodeSlug}.mp3")
    @RequiresModule({PodcastModule.KEY, PodcastRssModule.KEY})
    ResponseEntity<Void> publicEnclosure(
            @PathVariable String tenantSlug,
            @PathVariable String episodeSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = tenantResolver.requireHostTenantBySlug(tenantSlug);

        var redirect = episodeEnclosureService.resolvePublicRedirect(tenant.getId(), episodeSlug);
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                tenant.getId(),
                redirect.episode(),
                "public-rss",
                request.getServerName()
        );
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(redirect.targetUrl().toString()))
                .build();
    }

    /**
     * Stable private enclosure proxy — feed token authenticates; tracks Umami then 302
     * to CDN (FREE) or short-lived S3 presign (PAID).
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

        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        var redirect = episodeEnclosureService.resolvePrivateRedirect(feed, episodeSlug);
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                tenant.getId(),
                redirect.episode(),
                "private-rss",
                request.getServerName()
        );
        return ResponseEntity.status(HttpStatus.FOUND)
                .cacheControl(CacheControl.noStore())
                .location(URI.create(redirect.targetUrl().toString()))
                .build();
    }

    private static ResponseEntity<String> rssResponse(RssFeedSnapshotService.FeedDelivery delivery) {
        if (!delivery.ready()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(CacheControl.noStore())
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(delivery.redirectUrl().toString()))
                .cacheControl(CacheControl.noStore())
                .build();
    }
}
