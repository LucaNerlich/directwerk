package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Fallback when object storage is disabled — remote ingest fails closed with 503.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "false", matchIfMissing = true)
public class UnsupportedRemoteAssetIngestApi implements RemoteAssetIngestApi {

    @Override
    public MediaAsset ingestFromUrl(IngestCommand command) {
        throw new StorageNotConfiguredException(
                "Object storage is disabled — set directwerk.storage.enabled=true"
        );
    }

    @Override
    public void discard(Long assetId) {
        throw new StorageNotConfiguredException(
                "Object storage is disabled — set directwerk.storage.enabled=true"
        );
    }
}
