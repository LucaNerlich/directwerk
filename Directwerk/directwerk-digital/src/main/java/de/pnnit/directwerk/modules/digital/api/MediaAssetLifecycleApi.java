package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;

/**
 * Irreversible media delete: queues S3 object removal (and CDN purge when applicable)
 * and immediately marks the row {@code PENDING_DELETE}. Workers tombstone to
 * {@code ARCHIVED} when side effects finish — restore is not supported.
 */
public interface MediaAssetLifecycleApi {

    /**
     * Authorizes deletion, marks the asset {@code PENDING_DELETE}, and enqueues
     * background jobs for S3 delete (and CDN purge when needed).
     * <p>
     * Idempotent: if the asset is already {@code PENDING_DELETE}, returns that asset
     * with 200 (after authorization check).
     * <p>
     * Already-archived assets result in a "not found" response (404).
     *
     * @param command asset id, caller principal, and whether this is platform ops
     * @return the asset in {@code PENDING_DELETE} state
     * @throws de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException
     *         if the asset does not exist or is already archived
     */
    MediaAsset delete(DeleteCommand command);

    /**
     * @param mediaAssetId asset to delete
     * @param principal    authenticated caller (required for tenant deletes)
     * @param platformOps  when true, skip scope/ownership checks (platform admin path)
     */
    record DeleteCommand(
            Long mediaAssetId,
            DirectwerkUserPrincipal principal,
            boolean platformOps
    ) {
    }
}
