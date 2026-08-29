package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

/**
 * Unified subscriber playback URL resolution for JWT portal and tokenized RSS paths.
 */
@Service
@RequiredArgsConstructor
public class SubscriberPlaybackService {

    private final AssetAccessApi assetAccessApi;
    private final EpisodeMediaApi episodeMediaApi;

    public URL resolvePortalPlayback(MediaAsset audioAsset, Episode episode, DirectwerkUserPrincipal user) {
        if (isPublisher(user)) {
            return assetAccessApi.resolvePreviewUrl(audioAsset, user, true);
        }
        return assetAccessApi.resolveEpisodePortalUrl(
                audioAsset,
                episode.getId(),
                episode.getAccessPolicy(),
                user
        );
    }

    public URL resolveRssPlayback(
            MediaAsset audioAsset,
            Episode episode,
            Long subscriberUserId,
            String episodeSlug
    ) {
        if (PublicSurfacePolicy.isFreeAccess(episode.getAccessPolicy().name())) {
            return episodeMediaApi.publicCdnUrl(audioAsset)
                    .orElseThrow(() -> new EpisodeNotFoundException(episodeSlug));
        }
        return assetAccessApi.resolveRssEnclosureUrl(audioAsset, subscriberUserId);
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
