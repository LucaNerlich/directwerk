package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicContentProjection;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.util.FeedUrls;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
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

    private final EpisodeRepository episodeRepository;
    private final SubscriberFeedAccess subscriberFeedAccess;
    private final EpisodeMediaApi episodeMediaApi;
    private final AssetAccessApi assetAccessApi;
    private final TenantPublicHostResolver tenantPublicHostResolver;

    public record EnclosureRedirect(Episode episode, URL targetUrl) {
    }

    @Transactional(readOnly = true)
    public EnclosureRedirect resolvePublicRedirect(Long tenantId, String episodeSlug) {
        Episode episode = requirePublishedPlayableEpisode(tenantId, episodeSlug);
        if (!PublicContentProjection.includesInPublicRss(episode.getAccessPolicy().name())) {
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
        Episode episode = requirePublishedPlayableEpisode(tenantId, episodeSlug);
        if (!subscriberFeedAccess.hasEpisodeAccess(
                tenantId, feed.getUser().getId(), feed, episode)) {
            throw new EpisodeNotFoundException(episodeSlug);
        }
        MediaAsset audio = episode.getAudioAsset();
        URL target;
        if (episode.getAccessPolicy() == AccessPolicy.FREE) {
            target = episodeMediaApi.publicCdnUrl(audio)
                    .orElseThrow(() -> new EpisodeNotFoundException(episodeSlug));
        } else {
            target = assetAccessApi.resolveRssEnclosureUrl(audio, feed.getUser().getId());
        }
        return new EnclosureRedirect(episode, target);
    }

    /**
     * Builds a stable public enclosure URL using a verified tenant domain.
     * The requested hostname is used only when it is an approved verified domain;
     * otherwise, the tenant's preferred verified domain is selected.
     *
     * @param tenantId           the tenant owning the enclosure
     * @param scheme             the URL scheme
     * @param requestedHostname the hostname requested by the caller
     * @param port              the URL port
     * @param tenantSlug         the tenant URL slug
     * @param episodeSlug        the episode URL slug
     * @return the stable public enclosure URL
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

    private Episode requirePublishedPlayableEpisode(Long tenantId, String episodeSlug) {
        Episode episode = episodeRepository.findByTenantIdAndSlugAndStatusAndSeriesStatus(
                tenantId,
                episodeSlug,
                EpisodeStatus.PUBLISHED,
                SeriesStatus.PUBLISHED
        ).orElseThrow(() -> new EpisodeNotFoundException(episodeSlug));

        if (!episode.isEnclosureEnabled()) {
            throw new EpisodeNotFoundException(episodeSlug);
        }

        MediaAsset audio = episode.getAudioAsset();
        if (audio == null
                || audio.getStatus() != AssetStatus.READY
                || audio.getAssetType() != AssetType.AUDIO) {
            throw new EpisodeNotFoundException(episodeSlug);
        }
        return episode;
    }
}
