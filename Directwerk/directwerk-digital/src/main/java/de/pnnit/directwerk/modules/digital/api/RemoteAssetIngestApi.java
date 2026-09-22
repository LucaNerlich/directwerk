package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.util.UUID;

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

    void discard(CleanupClaim cleanupClaim);

    record CleanupClaim(Long assetId, UUID token) {
        public CleanupClaim {
            if (assetId == null || token == null) {
                throw new IllegalArgumentException("Cleanup claim requires an asset id and token");
            }
        }
    }

    /**
     * Outcome of an ingest request.
     *
     * @param asset  the resolved media asset (newly created or reused)
     * @param reused {@code true} when an existing asset for the same source URL was returned;
     *               callers must not register reused assets for failure cleanup, since deleting
     *               them would break already-published content that references them
     * @param cleanupClaim ownership proof for cleanup of a new ingest; {@code null} when reused
     */
    record IngestResult(MediaAsset asset, boolean reused, CleanupClaim cleanupClaim) {
        public IngestResult {
            if (reused && cleanupClaim != null) {
                throw new IllegalArgumentException("Reused assets must not expose cleanup ownership");
            }
            if (!reused && cleanupClaim == null) {
                throw new IllegalArgumentException("New ingests require cleanup ownership");
            }
        }
    }

    record IngestCommand(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility intendedVisibility,
            String filenameHint
    ) {
    }
}
