package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService.EnclosureRedirect;
import de.pnnit.directwerk.modules.podcast.service.EpisodePlaybackDeliveryFacade.TrackedRedirect;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
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
        EnclosureRedirect redirect = episodeEnclosureService.resolvePublicRedirect(tenantId, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenantId,
                redirect,
                analyticsSource,
                requestHost,
                false
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

    public TrackedEnclosureRedirect privateEnclosure(
            Tenant tenant,
            String feedToken,
            String episodeSlug,
            String analyticsSource,
            String requestHost
    ) {
        SubscriberFeed feed = subscriberFeedService.requireDeliverableFeed(tenant.getId(), feedToken);
        EnclosureRedirect redirect = episodeEnclosureService.resolvePrivateRedirect(feed, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverEnclosure(
                tenant.getId(),
                redirect,
                analyticsSource,
                requestHost,
                true
        );
        return new TrackedEnclosureRedirect(redirect, tracked.response());
    }

    public static ResponseEntity<String> rssRedirect(URL redirectUrl, boolean ready) {
        if (!ready) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(CacheControl.noStore())
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(java.net.URI.create(redirectUrl.toString()))
                .cacheControl(CacheControl.noStore())
                .build();
    }
}
