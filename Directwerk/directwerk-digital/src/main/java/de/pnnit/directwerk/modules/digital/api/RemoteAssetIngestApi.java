package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;

/**
 * Server-side ingest: stream a remote HTTP body into tenant object storage without buffering it.
 */
public interface RemoteAssetIngestApi {

    /**
 * Ingests a remote asset into tenant object storage.
 *
 * @param command the ingestion request containing the source URL and asset metadata
 * @return the ingested media asset
 */
MediaAsset ingestFromUrl(IngestCommand command);

    /**
 * Discards an asset created by this ingestion API before it is attached to content.
 *
 * @param assetId the identifier of the asset to discard
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
