package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateUploadUrlRequest(
        @NotBlank @Size(max = 255) String filename,
        @NotBlank @Size(max = 128) String mimeType,
        @Positive long sizeBytes,
        @NotNull AssetType assetType,
        AssetVisibility intendedVisibility,
        AssetScope scope,
        @Positive Long episodeId,
        @Positive Long ownerUserId
) {
}
