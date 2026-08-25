package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;

final class MediaAssetTenantCheck {

    private MediaAssetTenantCheck() {
    }

    static void assertTenantMatch(MediaAsset asset) {
        Long contextTenantId = TenantContext.getTenantId();
        if (contextTenantId == null || !contextTenantId.equals(asset.getTenant().getId())) {
            throw new TenantMismatchException("Media asset tenant does not match request tenant");
        }
    }
}
