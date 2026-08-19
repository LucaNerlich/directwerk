package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ModuleNotEnabledException;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.exception.SeriesNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.podcast.repository.PodcastSeriesRepository;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
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

    private final TenantRepository tenantRepository;
    private final PodcastSeriesRepository podcastSeriesRepository;
    private final SubscriberFeedService subscriberFeedService;
    private final RssFeedSnapshotService rssFeedSnapshotService;
    private final EpisodeEnclosureService episodeEnclosureService;
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;
    private final ModuleGateService moduleGateService;

    public RssFeedController(
            TenantRepository tenantRepository,
            PodcastSeriesRepository podcastSeriesRepository,
            SubscriberFeedService subscriberFeedService,
            RssFeedSnapshotService rssFeedSnapshotService,
            EpisodeEnclosureService episodeEnclosureService,
            EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService,
            ModuleGateService moduleGateService
    ) {
        this.tenantRepository = tenantRepository;
        this.podcastSeriesRepository = podcastSeriesRepository;
        this.subscriberFeedService = subscriberFeedService;
        this.rssFeedSnapshotService = rssFeedSnapshotService;
        this.episodeEnclosureService = episodeEnclosureService;
        this.episodeDownloadAnalyticsService = episodeDownloadAnalyticsService;
        this.moduleGateService = moduleGateService;
    }

    /**
     * Resolves the public podcast RSS feed for a tenant to its public pull-zone object.
     *
     * @param tenantSlug the tenant's URL slug
     * @param request    the request used to determine feed URL details
     * @return the public podcast RSS feed response
     */
    @GetMapping("/podcast.xml")
    ResponseEntity<String> publicPodcastFeed(@PathVariable String tenantSlug) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY);

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
    ResponseEntity<String> publicSeriesFeed(
            @PathVariable String tenantSlug,
            @PathVariable String seriesSlug
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY);

        PodcastSeries series = podcastSeriesRepository.findByTenantIdAndSlug(tenant.getId(), seriesSlug)
                .orElseThrow(() -> new SeriesNotFoundException(seriesSlug));
        var delivery = rssFeedSnapshotService.publicSeriesFeed(tenant, series);
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
    ResponseEntity<String> privateSubscriberFeed(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY);

        SubscriberFeed feed = requireEnabledFeed(tenant, feedToken);
        requireCustomFeedModule(feed);
        var delivery = rssFeedSnapshotService.privateFeed(tenant, feed);
        return rssResponse(delivery);
    }

    /**
     * Stable public enclosure proxy — no auth. Tracks Umami then 302 to CDN.
     */
    @GetMapping("/e/{episodeSlug}.mp3")
    ResponseEntity<Void> publicEnclosure(
            @PathVariable String tenantSlug,
            @PathVariable String episodeSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(PodcastModule.KEY, PodcastRssModule.KEY);

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
    ResponseEntity<Void> privateEnclosure(
            @PathVariable String tenantSlug,
            @PathVariable String feedToken,
            @PathVariable String episodeSlug,
            HttpServletRequest request
    ) {
        Tenant tenant = requireHostTenant(tenantSlug);
        requireModules(
                PodcastModule.KEY,
                PodcastRssModule.KEY,
                SubscriptionModule.MODULE_KEY
        );

        SubscriberFeed feed = requireEnabledFeed(tenant, feedToken);
        requireCustomFeedModule(feed);
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

    private SubscriberFeed requireEnabledFeed(Tenant tenant, String feedToken) {
        SubscriberFeed feed = subscriberFeedService.requireFeedByToken(feedToken);
        if (!tenant.getId().equals(feed.getTenant().getId()) || !feed.isEnabled()) {
            throw new SubscriberFeedNotFoundException();
        }
        return feed;
    }

    /**
     * Custom feeds 404 (not JSON 403) when FEED_BUILDER is off so podcatchers do not see an API error.
     */
    private void requireCustomFeedModule(SubscriberFeed feed) {
        if (feed.isDefaultFeed()) {
            return;
        }
        try {
            moduleGateService.requireModule(FeedBuilderModule.KEY);
        } catch (ModuleNotEnabledException ex) {
            throw new SubscriberFeedNotFoundException();
        }
    }

    private Tenant requireHostTenant(String tenantSlug) {
        Long tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new TenantNotFoundException(tenantSlug);
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new TenantNotFoundException(tenantSlug));
        if (!tenant.getSlug().equals(tenantSlug)) {
            throw new TenantNotFoundException(tenantSlug);
        }
        return tenant;
    }

    /** Resolves to 403 {@code FEATURE_NOT_ENABLED} — not {@code TENANT_NOT_FOUND}. */
    private void requireModules(String... moduleKeys) {
        for (String moduleKey : moduleKeys) {
            moduleGateService.requireModule(moduleKey);
        }
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
