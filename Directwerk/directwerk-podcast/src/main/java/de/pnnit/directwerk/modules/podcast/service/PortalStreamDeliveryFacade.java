package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService;
import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService.EpisodeStream;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    public record TrackedStreamRedirect(EpisodeStream stream, ResponseEntity<Void> response) {
    }

    public TrackedStreamRedirect streamEpisode(
            DirectwerkUserPrincipal user,
            String episodeSlug,
            String requestHost
    ) {
        EpisodeStream stream = subscriberPortalAccessService.resolveStream(user, episodeSlug);
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                user.tenantId(),
                stream.episode(),
                "stream",
                requestHost
        );
        return new TrackedStreamRedirect(
                stream,
                ResponseEntity.status(HttpStatus.FOUND)
                        .location(URI.create(stream.url().toString()))
                        .build()
        );
    }
}
