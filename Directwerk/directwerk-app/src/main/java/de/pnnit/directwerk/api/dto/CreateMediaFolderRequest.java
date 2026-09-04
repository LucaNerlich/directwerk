package de.pnnit.directwerk.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMediaFolderRequest(
        @NotBlank @Size(max = 255) String name,
        @Min(1) Long parentId
) {
}
