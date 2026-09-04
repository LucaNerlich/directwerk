package de.pnnit.directwerk.api.dto;

import java.time.Instant;

public record MediaAssetView(
        Long id,
        String s3Key,
        String visibility,
        String scope,
        String assetType,
        String status,
        String mimeType,
        Long sizeBytes,
        Long bytesTransferred,
        String originalFilename,
        Long episodeId,
        Long ownerUserId,
        Long folderId,
        Long createdBy,
        String cdnUrl,
        Instant createdAt,
        Instant updatedAt
) {
}
