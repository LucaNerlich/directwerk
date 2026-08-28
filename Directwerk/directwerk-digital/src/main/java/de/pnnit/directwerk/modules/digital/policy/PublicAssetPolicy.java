package de.pnnit.directwerk.modules.digital.policy;

import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;

/**
 * Single eligibility rule for public CDN delivery of a {@link MediaAsset}.
 * RSS, public site listings, and enclosure redirects share this module.
 */
public final class PublicAssetPolicy {

    private PublicAssetPolicy() {}

    public static boolean isPublicCdnEligible(String tenantSlug, MediaAsset asset) {
        if (asset == null
                || asset.getVisibility() != AssetVisibility.PUBLIC
                || asset.getS3Key() == null) {
            return false;
        }
        return TenantAssetKeys.isPublicKey(tenantSlug, asset.getS3Key());
    }
}
