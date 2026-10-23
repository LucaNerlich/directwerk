package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
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
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest,
            String clientIp
    ) {
        EnclosureRedirect redirect = episodeEnclosureService.resolvePublicRedirect(tenantId, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenantId,
                redirect,
                analyticsSource,
                requestHost,
                clientUserAgent,
                isRangeRequest,
                clientIp
        );
        return new TrackedEnclosureRedirect(redirect, tracked.response());
    }

    public TrackedEnclosureRedirect publicEnclosure(
            Tenant tenant,
            String episodeSlug,
            String analyticsSource,
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest,
            String clientIp
    ) {
        return publicEnclosure(
                tenant.getId(), episodeSlug, analyticsSource, requestHost,
                clientUserAgent, isRangeRequest, clientIp);
    }

    public TrackedEnclosureRedirect privateEnclosure(
            Tenant tenant,
            String feedToken,
            String episodeSlug,
            String analyticsSource,
            String requestHost,
            String clientUserAgent,
            boolean isRangeRequest,
            String clientIp
    ) {
        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        EnclosureRedirect redirect = episodeEnclosureService.resolvePrivateRedirect(feed, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenant.getId(),
                redirect,
                analyticsSource,
                requestHost,
                clientUserAgent,
                isRangeRequest,
                clientIp
        );
        return new TrackedEnclosureRedirect(redirect, tracked.response());
    }
}
