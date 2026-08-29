package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;

/**
 * Server-side ingest: stream a remote HTTP body into tenant object storage without buffering it.
 */
public interface RemoteAssetIngestApi {

    MediaAsset ingestFromUrl(IngestCommand command);

    /**
     * Best-effort rollback for an asset created by this ingest API before it
     * became attached to content.
     */
    void discard(Long assetId);

    record IngestCommand(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility intendedVisibility,
            String filenameHint
    ) {
    }
}
