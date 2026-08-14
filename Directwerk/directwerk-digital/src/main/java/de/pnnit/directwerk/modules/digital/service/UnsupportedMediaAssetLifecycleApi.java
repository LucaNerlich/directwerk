package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Fallback when object storage is disabled — delete endpoints fail closed with 503.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "false", matchIfMissing = true)
public class UnsupportedMediaAssetLifecycleApi implements MediaAssetLifecycleApi {

    @Override
    public MediaAsset delete(DeleteCommand command) {
        throw new StorageNotConfiguredException(
                "Object storage is disabled — set directwerk.storage.enabled=true"
        );
    }
}
