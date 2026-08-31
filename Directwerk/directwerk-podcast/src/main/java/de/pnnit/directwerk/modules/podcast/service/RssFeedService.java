package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.access.SubscriberFeedAccess;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RssFeedService {

    private final PublicPodcastQueryService publicPodcastQueryService;
    private final SubscriberEpisodeService subscriberEpisodeService;
    private final SubscriberFeedAccess subscriberFeedAccess;
    private final RssXmlBuilder rssXmlBuilder;
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;
    private final PublicCdnUrlResolver publicCdnUrlResolver;
    private final EpisodeCoverResolver episodeCoverResolver;

    /**
     * Builds a public RSS feed containing eligible free episodes for a tenant or series.
     *
     * @param tenant      the tenant whose episodes are included
     * @param seriesOrNull the series to scope the feed to, or {@code null} for all series
     * @param scheme      the URL scheme used for feed and enclosure URLs
     * @param host        the URL host used for feed and enclosure URLs
     * @param port        the URL port used for feed and enclosure URLs
     * @return the generated RSS feed XML
     */
    @Transactional(readOnly = true)
    public String buildPublicFeed(Tenant tenant, PodcastSeries seriesOrNull, String scheme, String host, int port) {
        Long seriesId = seriesOrNull != null ? seriesOrNull.getId() : null;
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<RssXmlBuilder.RssEpisode> episodes = publicPodcastQueryService
                .listPublishedEpisodes(tenant.getId(), seriesId)
                .stream()
                .filter(episode -> PublicSurfacePolicy.isFreeAccess(episode.getAccessPolicy().name()))
                .filter(Episode::isEnclosureEnabled)
                .map(episode -> toPublicRssEpisode(episode, tenant, scheme, host, port))
                .flatMap(Optional::stream)
                .toList();
        String channelCoverUrl = resolvePublicCoverUrl(seriesOrNull != null ? seriesOrNull.getCoverAsset() : null);
        return rssXmlBuilder.buildPublicFeed(tenant, seriesOrNull, episodes, originBaseUrl, null, channelCoverUrl);
    }

    /**
     * Builds a private RSS feed containing entitled episodes with enabled enclosures.
     *
     * @param tenant the tenant whose episodes belong in the feed
     * @param feed the subscriber feed used to determine eligibility and feed access
     * @param scheme the URL scheme for enclosure and feed links
     * @param host the URL host for enclosure and feed links
     * @param port the URL port for enclosure and feed links
     * @return the generated RSS feed XML
     * @throws SubscriberFeedNotFoundException if the subscriber feed is disabled
     */
    @Transactional(readOnly = true)
    public String buildPrivateFeed(Tenant tenant, SubscriberFeed feed, String scheme, String host, int port) {
        if (!feed.isEnabled()) {
            throw new de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedNotFoundException();
        }
        String originBaseUrl = PublicUrlBuilder.baseUrl(scheme, host, port);
        List<RssXmlBuilder.RssEpisode> episodes = subscriberFeedAccess
                .listEntitledEpisodes(tenant.getId(), feed.getUser().getId(), feed)
                .stream()
                .filter(Episode::isEnclosureEnabled)
                .map(episode -> toPrivateRssEpisode(episode, tenant, feed.getFeedToken(), scheme, host, port))
                .flatMap(Optional::stream)
                .toList();
        return rssXmlBuilder.buildPublicFeed(tenant, null, episodes, originBaseUrl, feed.getTitle(), null);
    }

    /**
     * Converts an eligible public episode into an RSS enclosure representation.
     *
     * @param episode the episode to convert
     * @param tenant  the tenant that owns the episode
     * @param scheme  the URL scheme for the enclosure
     * @param host    the URL host for the enclosure
     * @param port    the URL port for the enclosure
     * @return an RSS episode representation, or an empty optional when the episode's audio asset is unavailable or ineligible
     */
    private Optional<RssXmlBuilder.RssEpisode> toPublicRssEpisode(
            Episode episode,
            Tenant tenant,
            String scheme,
            String host,
            int port
    ) {
        MediaAsset asset = episode.getAudioAsset();
        if (!isReadyAudio(asset) || publicCdnUrlResolver.resolve(asset).isEmpty()) {
            return Optional.empty();
        }
        // Always use the stable public enclosure proxy (Umami + CDN redirect); never embed CDN/S3.
        String url = episodeDownloadAnalyticsService.publicRssEnclosureUrl(
                tenant.getId(),
                scheme,
                host,
                port,
                tenant.getSlug(),
                episode.getSlug()
        );
        return Optional.of(toRssEpisode(episode, asset, url));
    }

    /**
     * @return the RSS episode representation when the episode has ready audio; otherwise, an empty optional
     */
    private Optional<RssXmlBuilder.RssEpisode> toPrivateRssEpisode(
            Episode episode,
            Tenant tenant,
            String feedToken,
            String scheme,
            String host,
            int port
    ) {
        MediaAsset asset = episode.getAudioAsset();
        if (!isReadyAudio(asset)) {
            return Optional.empty();
        }
        if (PublicSurfacePolicy.isFreeAccess(episode.getAccessPolicy().name())) {
            return toPublicRssEpisode(episode, tenant, scheme, host, port);
        }
        String url = episodeDownloadAnalyticsService.privateRssEnclosureUrl(
                tenant.getId(),
                scheme,
                host,
                port,
                tenant.getSlug(),
                feedToken,
                episode.getSlug()
        );
        return Optional.of(toRssEpisode(episode, asset, url));
    }

    private static boolean isReadyAudio(MediaAsset asset) {
        return asset != null
                && asset.getStatus() == AssetStatus.READY
                && asset.getAssetType() == AssetType.AUDIO;
    }

    private String resolvePublicCoverUrl(MediaAsset asset) {
        return publicCdnUrlResolver.resolve(asset).map(java.net.URL::toString).orElse(null);
    }

    private RssXmlBuilder.RssEpisode toRssEpisode(Episode episode, MediaAsset asset, String url) {
        String coverUrl = episodeCoverResolver.resolveCoverAsset(episode)
                .flatMap(publicCdnUrlResolver::resolve)
                .map(java.net.URL::toString)
                .orElse(null);
        return new RssXmlBuilder.RssEpisode(
                episode,
                url,
                asset.getSizeBytes(),
                asset.getMimeType(),
                coverUrl
        );
    }
}
