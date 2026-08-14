package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.net.URL;

/**
 * Resolves download URLs for media assets after tenant and entitlement checks.
 */
public interface AssetAccessApi {

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
     * Publisher preview path: EDITOR / TENANT_ADMIN may bypass CONTENT entitlements
     * for in-tenant preview (including drafts).
     */
    URL resolvePreviewUrl(MediaAsset asset, DirectwerkUserPrincipal principal, boolean previewDraft);
}
