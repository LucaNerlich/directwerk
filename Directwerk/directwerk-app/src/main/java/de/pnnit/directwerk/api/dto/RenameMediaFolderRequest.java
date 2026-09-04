package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameMediaFolderRequest(
        @NotBlank @Size(max = 255) String name
) {
}
