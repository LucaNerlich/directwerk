package de.pnnit.directwerk.api.dto;

import java.time.Instant;

public record MediaFolderView(
        Long id,
        String name,
        Long parentId,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt
) {
}
