package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService.EnclosureRedirect;
import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService.EpisodeStream;
import java.net.URI;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * Shared resolve → analytics → redirect choreography for RSS enclosures and portal streams.
 */
@Service
@RequiredArgsConstructor
public class EpisodePlaybackDeliveryFacade {

    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    public record TrackedRedirect(Episode episode, URL targetUrl, ResponseEntity<Void> response) {
    }

    public TrackedRedirect deliverEnclosure(
            Long tenantId,
            EnclosureRedirect redirect,
            String analyticsSource,
            String requestHost,
            boolean privateFeed
    ) {
        return deliverEnclosure(tenantId, redirect, analyticsSource, requestHost, privateFeed, null, false);
    }

    public TrackedRedirect deliverEnclosure(
            Long tenantId,
            EnclosureRedirect redirect,
            String analyticsSource,
            String requestHost,
            boolean privateFeed,
            String clientUserAgent,
            boolean isRangeRequest
    ) {
        return deliverEnclosure(
                tenantId, redirect, analyticsSource, requestHost, privateFeed,
                clientUserAgent, isRangeRequest, null);
    }

    public TrackedRedirect deliverEnclosure(
            Long tenantId,
            EnclosureRedirect redirect,
            String analyticsSource,
            String requestHost,
            boolean privateFeed,
            String clientUserAgent,
            boolean isRangeRequest,
            String clientIp
    ) {
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                tenantId,
                redirect.episode(),
                analyticsSource,
                requestHost,
                clientUserAgent,
                isRangeRequest,
                clientIp
        );
        // noStore on both public and private: a cached 302 would skip tracking on repeat plays.
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(redirect.targetUrl().toString()))
                .cacheControl(CacheControl.noStore());
        return new TrackedRedirect(redirect.episode(), redirect.targetUrl(), builder.build());
    }

    public TrackedRedirect deliverStream(
            Long tenantId,
            EpisodeStream stream,
            String requestHost
    ) {
        return deliverStream(tenantId, stream, requestHost, null);
    }

    public TrackedRedirect deliverStream(
            Long tenantId,
            EpisodeStream stream,
            String requestHost,
            String clientUserAgent
    ) {
        return deliverStream(tenantId, stream, requestHost, clientUserAgent, null);
    }

    public TrackedRedirect deliverStream(
            Long tenantId,
            EpisodeStream stream,
            String requestHost,
            String clientUserAgent,
            String clientIp
    ) {
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                tenantId,
                stream.episode(),
                "stream",
                requestHost,
                clientUserAgent,
                false,
                clientIp
        );
        return new TrackedRedirect(
                stream.episode(),
                stream.url(),
                ResponseEntity.status(HttpStatus.FOUND)
                        .location(URI.create(stream.url().toString()))
                        .cacheControl(CacheControl.noStore())
                        .build()
        );
    }
}
