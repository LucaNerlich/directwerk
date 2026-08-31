package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.util.FeedUrls;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.access.PublishedPlayableEpisodeGuard;
import de.pnnit.directwerk.modules.podcast.access.PublishedPlayableEpisodeGuard.PlaybackSurface;
import de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess;
import de.pnnit.directwerk.modules.podcast.access.SubscriberPlaybackService;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves stable RSS enclosure proxy URLs to a short-lived CDN or S3 target.
 * Public proxies skip auth; private proxies authenticate via feed token + entitlement.
 */
@Service
@RequiredArgsConstructor
public class EpisodeEnclosureService {

    private final SubscriberFeedAccess subscriberFeedAccess;
    private final SubscriberPlaybackService subscriberPlaybackService;
    private final PublishedPlayableEpisodeGuard publishedPlayableEpisodeGuard;
    private final EpisodeMediaApi episodeMediaApi;
    private final TenantPublicHostResolver tenantPublicHostResolver;

    public record EnclosureRedirect(Episode episode, URL targetUrl) {
    }

    @Transactional(readOnly = true)
    public EnclosureRedirect resolvePublicRedirect(Long tenantId, String episodeSlug) {
        Episode episode = publishedPlayableEpisodeGuard.requirePlayable(
                tenantId,
                episodeSlug,
                PlaybackSurface.ENCLOSURE
        );
        if (!PublicSurfacePolicy.includesInPublicRss(episode.getAccessPolicy().name())) {
            throw new EpisodeNotFoundException(episodeSlug);
        }
        URL target = episodeMediaApi.publicCdnUrl(episode.getAudioAsset())
                .orElseThrow(() -> new EpisodeNotFoundException(episodeSlug));
        return new EnclosureRedirect(episode, target);
    }

    @Transactional(readOnly = true)
    public EnclosureRedirect resolvePrivateRedirect(SubscriberFeed feed, String episodeSlug) {
        if (feed == null || !feed.isEnabled()) {
            throw new SubscriberFeedNotFoundException();
        }
        Long tenantId = feed.getTenant().getId();
        Episode episode = publishedPlayableEpisodeGuard.requirePlayable(
                tenantId,
                episodeSlug,
                PlaybackSurface.ENCLOSURE
        );
        if (!subscriberFeedAccess.hasEpisodeAccess(
                tenantId, feed.getUser().getId(), feed, episode)) {
            throw new EpisodeNotFoundException(episodeSlug);
        }
        MediaAsset audio = episode.getAudioAsset();
        URL target = subscriberPlaybackService.resolveRssPlayback(
                audio,
                episode,
                feed.getUser().getId(),
                episodeSlug
        );
        return new EnclosureRedirect(episode, target);
    }

    /**
     * The requested hostname is used only when it is an approved verified domain;
     * otherwise, the tenant's preferred verified domain is selected.
     */
    @Transactional(readOnly = true)
    public String publicEnclosureUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String episodeSlug
    ) {
        String host = tenantPublicHostResolver.resolve(
                tenantId,
                requestedHostname,
                TenantPublicHostResolver.HostPolicy.TRUST_REQUEST
        );
        return FeedUrls.publicEnclosure(
                PublicUrlBuilder.baseUrl(scheme, host, port),
                tenantSlug,
                episodeSlug
        );
    }

    /**
     * Builds a stable private enclosure URL using a verified tenant domain.
     *
     * @param requestedHostname the requested host when it is a verified tenant domain
     * @return the private enclosure URL for the episode
     */
    @Transactional(readOnly = true)
    public String privateEnclosureUrl(
            Long tenantId,
            String scheme,
            String requestedHostname,
            int port,
            String tenantSlug,
            String feedToken,
            String episodeSlug
    ) {
        String host = tenantPublicHostResolver.resolve(
                tenantId,
                requestedHostname,
                TenantPublicHostResolver.HostPolicy.TRUST_REQUEST
        );
        return FeedUrls.privateEnclosure(
                PublicUrlBuilder.baseUrl(scheme, host, port),
                tenantSlug,
                feedToken,
                episodeSlug
        );
    }
}
