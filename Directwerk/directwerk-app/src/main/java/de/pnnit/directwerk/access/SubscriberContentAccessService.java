package de.pnnit.directwerk.access;

import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One deep operation for "what may this subscriber listen to / download?".
 *
 * <p>Absorbs the decisions that used to be re-composed in every caller: module gating,
 * the publisher (EDITOR/TENANT_ADMIN) preview branch, the PAID⇒SUBSCRIPTION coupling, the
 * audio-asset READY check, entitlement evaluation and the download cap. Ordering is the
 * security property here — every gate runs <em>before</em> any URL is resolved — and it is
 * now asserted in one place instead of being scattered across controllers.</p>
 */
@Service
@RequiredArgsConstructor
public class SubscriberContentAccessService {

    private static final int MAX_DOWNLOADS = 50;

    private final SubscriberEpisodeService subscriberEpisodeService;
    private final AssetAccessApi assetAccessApi;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final ModuleGateService moduleGateService;
    private final EntitlementService entitlementService;

    /** A streamable episode: the published episode plus the URL its audio may be fetched from. */
    public record EpisodeStream(Episode episode, URL url) {
    }

    /** A downloadable asset: the READY media asset plus its signed or CDN URL. */
    public record AssetDownload(MediaAsset asset, URL url) {
    }

    /**
     * Resolves the playback URL for a published episode on behalf of the current user.
     * Publishers get preview URLs (including private paid audio); subscribers are
     * entitlement-checked after the SUBSCRIPTION gate has been verified for paid episodes.
     */
    @Transactional(readOnly = true)
    public EpisodeStream resolveStream(DirectwerkUserPrincipal user, String episodeSlug) {
        Long tenantId = TenantContext.requireTenantId();
        // Gate first: no episode lookup, no URL resolution before the tenant may serve podcasts.
        moduleGateService.requireModule(PodcastModule.KEY);

        Episode episode = subscriberEpisodeService.requirePublishedEpisode(tenantId, episodeSlug);
        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset == null || audioAsset.getStatus() != AssetStatus.READY) {
            throw new EpisodeValidationException("Episode audio asset must be READY");
        }
        return new EpisodeStream(episode, resolvePlayableUrl(audioAsset, episode, user));
    }

    /**
     * Lists the current user's entitled, READY digital assets with resolved download URLs,
     * capped at {@value #MAX_DOWNLOADS} entries. Fail closed per asset: an asset without an
     * authorized URL is silently skipped, never leaked.
     */
    @Transactional(readOnly = true)
    public List<AssetDownload> listDownloads(DirectwerkUserPrincipal user) {
        moduleGateService.requireModule(DigitalContentModule.KEY);
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);

        List<Long> entitledIds = entitlementService.listEntitledDigitalAssetIds(user.tenantId(), user.userId());
        List<MediaAsset> readyAssets = entitledIds.stream()
                .flatMap(assetId -> mediaAssetQueryApi.findById(assetId).stream())
                .filter(asset -> asset.getStatus() == AssetStatus.READY)
                .limit(MAX_DOWNLOADS)
                .toList();
        return assetAccessApi.resolveDownloadUrls(readyAssets, user).stream()
                .map(resolved -> new AssetDownload(resolved.asset(), resolved.url()))
                .toList();
    }

    /**
     * Lists the current user's library: publishers see all published episodes, subscribers
     * their entitled ones — each with its playable URL when the audio asset is READY.
     */
    @Transactional(readOnly = true)
    public List<EpisodeStream> listMyEpisodes(DirectwerkUserPrincipal user) {
        Long tenantId = TenantContext.requireTenantId();
        // Gate first: no episode listing before the tenant may serve podcasts.
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
        if (audioAsset == null || audioAsset.getStatus() != AssetStatus.READY) {
            return null;
        }
        return resolvePlayableUrl(audioAsset, episode, user);
    }

    private URL resolvePlayableUrl(MediaAsset audioAsset, Episode episode, DirectwerkUserPrincipal user) {
        // Editors/admins get in-tenant preview URLs (including private PAID audio).
        // Subscribers get entitlement-checked download/presign URLs.
        if (isPublisher(user)) {
            return assetAccessApi.resolvePreviewUrl(audioAsset, user, true);
        }
        if (episode.getAccessPolicy() == AccessPolicy.PAID) {
            moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
        }
        return assetAccessApi.resolveDownloadUrl(audioAsset, user);
    }

    private static boolean isPublisher(DirectwerkUserPrincipal user) {
        return user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority ->
                        RoleConstants.EDITOR.equals(authority)
                                || RoleConstants.TENANT_ADMIN.equals(authority)
                );
    }
}
