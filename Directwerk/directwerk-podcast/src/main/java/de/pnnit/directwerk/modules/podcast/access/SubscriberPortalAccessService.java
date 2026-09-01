package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.BonusContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.access.PublishedPlayableEpisodeGuard.PlaybackSurface;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * JWT subscriber portal access: Episode streams, library listing, MediaAsset downloads.
 * Complements {@link SubscriberFeedAccess} (tokenized RSS/enclosure paths).
 */
@Service
@RequiredArgsConstructor
public class SubscriberPortalAccessService {

    private static final int MAX_DOWNLOADS = 50;

    private final SubscriberEpisodeService subscriberEpisodeService;
    private final AssetAccessApi assetAccessApi;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final ModuleGateService moduleGateService;
    private final EntitlementApi entitlementApi;
    private final SubscriberPlaybackService subscriberPlaybackService;
    private final PublishedPlayableEpisodeGuard publishedPlayableEpisodeGuard;

    public record EpisodeStream(Episode episode, URL url) {
    }

    public record AssetDownload(MediaAsset asset, URL url) {
    }

    @Transactional(readOnly = true)
    public EpisodeStream resolveStream(DirectwerkUserPrincipal user, String episodeSlug) {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(PodcastModule.KEY);

        Episode episode = publishedPlayableEpisodeGuard.requirePlayable(
                tenantId,
                episodeSlug,
                PlaybackSurface.PORTAL_STREAM
        );
        return new EpisodeStream(
                episode,
                subscriberPlaybackService.resolvePortalPlayback(episode.getAudioAsset(), episode, user)
        );
    }

    @Transactional(readOnly = true)
    public List<AssetDownload> listDownloads(DirectwerkUserPrincipal user) {
        moduleGateService.requireModule(BonusContentModule.KEY);
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);

        List<Long> entitledIds = entitlementApi.listEntitledDigitalAssetIds(user.tenantId(), user.userId());
        List<MediaAsset> readyAssets = entitledIds.stream()
                .flatMap(assetId -> mediaAssetQueryApi.findById(assetId).stream())
                .filter(asset -> asset.getStatus() == AssetStatus.READY)
                .limit(MAX_DOWNLOADS)
                .toList();
        return assetAccessApi.resolveDownloadUrls(readyAssets, user).stream()
                .map(resolved -> new AssetDownload(resolved.asset(), resolved.url()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EpisodeStream> listMyEpisodes(DirectwerkUserPrincipal user) {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(PodcastModule.KEY);

        List<Episode> episodes = RoleConstants.isEditorOrTenantAdmin(user)
                ? subscriberEpisodeService.listPublishedEpisodes(tenantId)
                : subscriberEpisodeService.listEntitledEpisodes(tenantId, user.userId());
        return episodes.stream()
                .map(episode -> new EpisodeStream(
                        episode,
                        playableUrlIfReady(episode.getAudioAsset(), episode, user)))
                .toList();
    }

    private URL playableUrlIfReady(MediaAsset audioAsset, Episode episode, DirectwerkUserPrincipal user) {
        if (!publishedPlayableEpisodeGuard.hasReadyAudio(audioAsset)) {
            return null;
        }
        return subscriberPlaybackService.resolvePortalPlayback(audioAsset, episode, user);
    }
}
