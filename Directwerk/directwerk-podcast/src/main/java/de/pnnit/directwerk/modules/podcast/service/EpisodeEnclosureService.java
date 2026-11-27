package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
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


}
