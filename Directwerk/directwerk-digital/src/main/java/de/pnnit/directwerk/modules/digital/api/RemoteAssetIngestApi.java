package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;

/**
 * Server-side ingest: stream a remote HTTP body into tenant object storage without buffering it.
 */
public interface RemoteAssetIngestApi {

    MediaAsset ingestFromUrl(IngestCommand command);

    record IngestCommand(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility intendedVisibility,
            String filenameHint
    ) {
    }
}
