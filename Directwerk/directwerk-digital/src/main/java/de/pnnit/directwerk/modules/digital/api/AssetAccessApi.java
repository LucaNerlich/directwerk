package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.net.URL;
import java.util.Collection;
import java.util.List;

/**
 * Resolves download URLs for media assets after tenant and entitlement checks.
 */
public interface AssetAccessApi {

    /** A resolved download: the (managed) asset plus its signed or CDN URL. */
    record ResolvedDownload(MediaAsset asset, URL url) {
    }

    /**
     * Resolves a download URL for the given asset (subscriber / general access path).
     *
     * <p>Public assets return a stable public CDN URL. Private assets return a Bunny Advanced
     * token URL on the private pull zone when configured, otherwise a short-lived S3
     * pre-signed GET, after scope authorization.</p>
     */
    URL resolveDownloadUrl(MediaAsset asset, DirectwerkUserPrincipal principal);

    /**
     * Resolves a public CDN URL or RSS-duration signed URL for a subscriber feed enclosure.
     */
    URL resolveRssEnclosureUrl(MediaAsset asset, Long subscriberUserId);

    /**
     * Subscriber portal playback for episode-linked audio. Applies subscription module gate for PAID
     * episodes before entitlement evaluation.
     */
    URL resolveEpisodePortalUrl(
            MediaAsset asset,
            Long episodeId,
            AccessPolicy accessPolicy,
            DirectwerkUserPrincipal principal
    );

    /**
     * Publisher preview path: EDITOR / TENANT_ADMIN may bypass CONTENT entitlements
     * for in-tenant preview (including drafts).
     */
    URL resolvePreviewUrl(MediaAsset asset, DirectwerkUserPrincipal principal, boolean previewDraft);

    /**
     * Batch form of {@link #resolveDownloadUrl}: one entitlement evaluation covers all
     * standalone private assets; public assets resolve to CDN URLs without checks.
     * Assets the principal may not access are silently skipped (fail closed) — the result
     * never contains an unauthorized URL.
     */
    List<ResolvedDownload> resolveDownloadUrls(Collection<MediaAsset> assets, DirectwerkUserPrincipal principal);
}
