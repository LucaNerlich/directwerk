package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService.EnclosureRedirect;
import de.pnnit.directwerk.modules.podcast.service.EpisodePlaybackDeliveryFacade.TrackedRedirect;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * RSS and enclosure delivery orchestration for public and private SubscriberFeed routes.
 */
@Service
@RequiredArgsConstructor
public class RssFeedDeliveryFacade {

    private final SubscriberFeedService subscriberFeedService;
    private final EpisodeEnclosureService episodeEnclosureService;
    private final EpisodePlaybackDeliveryFacade episodePlaybackDeliveryFacade;

    public record TrackedEnclosureRedirect(EnclosureRedirect redirect, ResponseEntity<Void> response) {
    }

    public TrackedEnclosureRedirect publicEnclosure(
            Long tenantId,
            String episodeSlug,
            String analyticsSource,
            String requestHost
    ) {
        return publicEnclosure(tenantId, episodeSlug, analyticsSource, requestHost, null, false);
    }

    public TrackedEnclosureRedirect publicEnclosure(
            Long tenantId,
            String episodeSlug,
            String analyticsSource,
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest
    ) {
        EnclosureRedirect redirect = episodeEnclosureService.resolvePublicRedirect(tenantId, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenantId,
                redirect,
                analyticsSource,
                requestHost,
                false,
                clientUserAgent,
                isRangeRequest
        );
        return new TrackedEnclosureRedirect(redirect, tracked.response());
    }

    public TrackedEnclosureRedirect publicEnclosure(
            Tenant tenant,
            String episodeSlug,
            String analyticsSource,
            String requestHost
    ) {
        return publicEnclosure(tenant.getId(), episodeSlug, analyticsSource, requestHost);
    }

    public TrackedEnclosureRedirect publicEnclosure(
            Tenant tenant,
            String episodeSlug,
            String analyticsSource,
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest
    ) {
        return publicEnclosure(tenant.getId(), episodeSlug, analyticsSource, requestHost, clientUserAgent, isRangeRequest);
    }

    public TrackedEnclosureRedirect privateEnclosure(
            Tenant tenant,
            String feedToken,
            String episodeSlug,
            String analyticsSource,
            String requestHost
    ) {
        return privateEnclosure(tenant, feedToken, episodeSlug, analyticsSource, requestHost, null, false);
    }

    public TrackedEnclosureRedirect privateEnclosure(
            Tenant tenant,
            String feedToken,
            String episodeSlug,
            String analyticsSource,
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest
    ) {
        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        EnclosureRedirect redirect = episodeEnclosureService.resolvePrivateRedirect(feed, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenant.getId(),
                redirect,
                analyticsSource,
                requestHost,
                true,
                clientUserAgent,
                isRangeRequest
        );
        return new TrackedEnclosureRedirect(redirect, tracked.response());
    }
}
