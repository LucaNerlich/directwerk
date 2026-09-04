package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;

public record MoveMediaAssetRequest(
        /** Target folder; {@code null} moves the asset to the library root. */
        @Min(1) Long folderId
) {
}
