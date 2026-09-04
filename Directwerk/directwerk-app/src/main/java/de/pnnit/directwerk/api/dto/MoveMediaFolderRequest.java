package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;

public record MoveMediaFolderRequest(
        /** New parent folder; {@code null} moves the folder to the library root. */
        @Min(1) Long parentId
) {
}
