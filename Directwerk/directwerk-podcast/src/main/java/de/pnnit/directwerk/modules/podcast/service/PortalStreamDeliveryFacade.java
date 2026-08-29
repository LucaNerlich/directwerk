package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService;
import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService.EpisodeStream;
import de.pnnit.directwerk.modules.podcast.service.EpisodePlaybackDeliveryFacade.TrackedRedirect;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;

/**
 * JWT portal stream delivery: resolve entitled stream URL, record analytics, return redirect.
 * Mirrors {@link RssFeedDeliveryFacade} for subscriber portal playback.
 */
@Service
@RequiredArgsConstructor
public class PortalStreamDeliveryFacade {

    private final SubscriberPortalAccessService subscriberPortalAccessService;
    private final EpisodePlaybackDeliveryFacade episodePlaybackDeliveryFacade;

    public record TrackedStreamRedirect(EpisodeStream stream, ResponseEntity<Void> response) {
    }

    public TrackedStreamRedirect streamEpisode(
            DirectwerkUserPrincipal user,
            String episodeSlug,
            String requestHost
    ) {
        EpisodeStream stream = subscriberPortalAccessService.resolveStream(user, episodeSlug);
        TrackedRedirect tracked = episodePlaybackDeliveryFacade.deliverStream(
                user.tenantId(),
                stream,
                requestHost
        );
        return new TrackedStreamRedirect(stream, tracked.response());
    }
}
