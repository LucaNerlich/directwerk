package de.pnnit.directwerk.api.dto;

import java.time.Instant;

/**
 * Studio media-library folder. {@code assetCount} is the direct (non-recursive) count of
 * active assets in this folder — same status filter as the default media list — so folder
 * tiles stay truthful when the asset list is folder-scoped and paged.
 */
public record MediaFolderView(
        Long id,
        String name,
        Long parentId,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt,
        long assetCount
) {
}
