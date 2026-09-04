package de.pnnit.directwerk.api.dto;

import java.time.Instant;

public record MediaFolderView(
        Long id,
        String name,
        Long parentId,
        Instant createdAt,
        Instant updatedAt
) {
}
