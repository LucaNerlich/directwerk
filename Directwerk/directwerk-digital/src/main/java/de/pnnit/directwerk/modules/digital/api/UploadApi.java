package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import java.time.Instant;
import java.util.Map;

/**
 * Upload pipeline: pre-signed PUT to staging, then confirm + promote to public/private.
 */
public interface UploadApi {

    UploadUrlResult createUploadUrl(CreateUploadUrlCommand command);

    ConfirmUploadResult confirmUpload(ConfirmUploadCommand command);

    record CreateUploadUrlCommand(
            String filename,
            String mimeType,
            long sizeBytes,
            AssetType assetType,
            AssetVisibility intendedVisibility,
            AssetScope scope,
            Long episodeId,
            Long ownerUserId,
            Long folderId
    ) {
    }

    record UploadUrlResult(
            Long assetId,
            String uploadUrl,
            Instant expiresAt,
            String stagingKey,
            Map<String, String> headers
    ) {
    }

    record ConfirmUploadCommand(Long mediaAssetId) {
    }

    record ConfirmUploadResult(
            Long mediaAssetId,
            String s3Key,
            String status,
            AssetVisibility visibility,
            Long sizeBytes,
            String mimeType
    ) {
    }
}
