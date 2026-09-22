package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;

/**
 * Server-side ingest: stream a remote HTTP body into tenant object storage without buffering it.
 */
public interface RemoteAssetIngestApi {

    IngestResult ingestFromUrl(IngestCommand command);

    /**
     * Starts ingesting a remote asset asynchronously and returns the pending asset immediately.
     *
     * @param command the ingestion request containing the source URL and asset metadata
     * @return the pending media asset whose ingest is processed by the {@code remote-asset-ingest} job queue
     */
    IngestResult startIngestFromUrl(IngestCommand command);

    void discard(Long assetId);

    /**
     * Outcome of an ingest request.
     *
     * @param asset  the resolved media asset (newly created or reused)
     * @param reused {@code true} when an existing asset for the same source URL was returned;
     *               callers must not register reused assets for failure cleanup, since deleting
     *               them would break already-published content that references them
     */
    record IngestResult(MediaAsset asset, boolean reused) {
    }

    record IngestCommand(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility intendedVisibility,
            String filenameHint
    ) {
    }
}
